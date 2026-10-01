"""Run/span context managers. Telemetry is best effort and never raises into agent code."""
import asyncio
import contextvars
import json
import queue
import re
import threading
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from uuid import uuid4

_current_run = contextvars.ContextVar('tracehaven_run', default=None)
_current_span = contextvars.ContextVar('tracehaven_span', default=None)


def redact(value):
    if isinstance(value, dict):
        return {k: '[REDACTED]' if any(x in k.lower() for x in ('password','secret','token','api_key','authorization')) else redact(v) for k,v in value.items()}
    if isinstance(value, (list, tuple)):
        return [redact(v) for v in value]
    if isinstance(value, str):
        value = re.sub(r'(?i)bearer\s+\S+', 'Bearer [REDACTED]', value)
        return re.sub(r'[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}', '[EMAIL]', value)
    return value


def now():
    return datetime.now(timezone.utc).isoformat()


class Span:
    def __init__(self, name, kind='tool', input=None, attributes=None):
        self.data = dict(span_id=str(uuid4()), step_name=name, kind=kind, input=input, attributes=attributes or {}, tool_calls=[], tokens=0)
        self.run = None

    def __enter__(self):
        self.run = _current_run.get()
        self.data.update(parent_span_id=_current_span.get(), started_at=now(), status='success')
        self.started = time.monotonic()
        self.token = _current_span.set(self.data['span_id'])
        if self.run:
            self.data['step_order'] = len(self.run.payload['steps'])
            self.run.payload['steps'].append(self.data)
        return self

    def set_output(self, value, tokens=0):
        self.data['output'] = value
        self.data['tokens'] = tokens

    def __exit__(self, exc_type, exc, tb):
        self.data.update(ended_at=now(), latency_ms=round((time.monotonic()-self.started)*1000, 3))
        if exc:
            self.data['status'] = 'failure'
            self.data['attributes']['error'] = str(exc)
        _current_span.reset(self.token)
        return False

    async def __aenter__(self):
        return self.__enter__()

    async def __aexit__(self, *args):
        return self.__exit__(*args)


class Run:
    def __init__(self, client, name, input=None, version='dev', case_id=None, model=None, prompt_version=None):
        self.client = client
        self.payload = dict(run_id=str(uuid4()), version=version, agent_name=name,
            project_name=client.project, workspace_name=client.workspace, user_email=client.owner,
            timestamp=now(), success=True, latency_ms=0, cost_cents=0, input_text=input,
            output_text=None, steps=[], evaluations=[], metrics=[], case_id=case_id, model=model,
            prompt_version=prompt_version)

    @property
    def id(self):
        return self.payload['run_id']

    def __enter__(self):
        self.started = time.monotonic()
        self.token = _current_run.set(self)
        self.span_token = _current_span.set(None)
        return self

    def set_output(self, value, cost_cents=0):
        self.payload.update(output_text=value, cost_cents=cost_cents)

    def evaluate(self, name, passed, feedback='', check_version='custom/1'):
        self.payload['evaluations'].append(dict(evaluator_name=name, score=float(passed), feedback=feedback, check_version=check_version))

    def __exit__(self, exc_type, exc, tb):
        try:
            self.payload['latency_ms'] = round((time.monotonic()-self.started)*1000, 3)
            if exc:
                self.payload.update(success=False, error_details=dict(error_type=exc_type.__name__, message=str(exc)))
            self.client._enqueue(self.payload)
        finally:
            _current_span.reset(self.span_token)
            _current_run.reset(self.token)
        return False

    async def __aenter__(self):
        return self.__enter__()

    async def __aexit__(self, *args):
        return self.__exit__(*args)


class Client:
    def __init__(self, endpoint='http://localhost:8000', project='Knowledge assistant', workspace='Local',
                 owner='developer@example.test', redactor=redact, capture_payloads=True, timeout=1, max_pending=100):
        self.endpoint = endpoint.rstrip('/') + '/api/ingest'
        self.project, self.workspace, self.owner = project, workspace, owner
        self.redactor, self.capture_payloads = redactor, capture_payloads
        self.timeout = max(0.1, min(timeout, 5))
        self.pending = queue.Queue(maxsize=max_pending)
        self.dropped = 0
        self.closed = False
        self._stop = threading.Event()
        self.thread = threading.Thread(target=self._worker, daemon=True)
        self.thread.start()

    def run(self, name, **kwargs):
        return Run(self, name, **kwargs)

    def span(self, name, **kwargs):
        return Span(name, **kwargs)

    def _enqueue(self, payload):
        try:
            if self.closed:
                self.dropped += 1
                return
            # Snapshot mutable values before returning control to application code.
            safe = self.redactor(json.loads(json.dumps(payload, default=str)))
            if not self.capture_payloads:
                safe['input_text'] = safe['output_text'] = None
                for s in safe['steps']:
                    s['input'] = s['output'] = None
                    s['attributes'] = {}
                    s['tool_calls'] = []
                if safe.get('error_details'):
                    safe['error_details']['message'] = '[payload capture disabled]'
            for key in ('input_text', 'output_text'):
                if safe[key] is not None and not isinstance(safe[key], str): safe[key] = json.dumps(safe[key])
            for s in safe['steps']:
                for key in ('input','output'):
                    if s.get(key) is not None and not isinstance(s[key],str): s[key] = json.dumps(s[key])
            body = json.dumps([safe]).encode()
            if len(body) > 1_000_000:
                self.dropped += 1
                return
            self.pending.put_nowait(body)
        except Exception:
            self.dropped += 1

    def _worker(self):
        while not self._stop.is_set() or not self.pending.empty():
            try:
                body = self.pending.get(timeout=0.1)
            except queue.Empty:
                continue
            delivered = False
            try:
                for attempt in range(3):
                    try:
                        request = urllib.request.Request(self.endpoint, body, {'Content-Type':'application/json'})
                        with urllib.request.urlopen(request, timeout=self.timeout):
                            delivered = True
                        break
                    except urllib.error.HTTPError as exc:
                        if exc.code < 500 and exc.code != 429: break
                    except Exception:
                        pass
                    if attempt < 2: time.sleep(0.1 * 2 ** attempt)
                if not delivered: self.dropped += 1
            finally:
                self.pending.task_done()

    def flush(self, timeout=2):
        deadline = time.monotonic() + max(0, timeout)
        while self.pending.unfinished_tasks and time.monotonic() < deadline:
            time.sleep(0.01)
        return self.pending.unfinished_tasks == 0

    def close(self, timeout=2):
        self.closed = True
        completed = self.flush(timeout)
        self._stop.set()
        return completed

    def __enter__(self): return self
    def __exit__(self, *args): self.close()
    async def __aenter__(self): return self
    async def __aexit__(self, *args): await asyncio.to_thread(self.close)
