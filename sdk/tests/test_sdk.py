import asyncio
import json
import sys
import threading
from pathlib import Path
from http.server import HTTPServer, BaseHTTPRequestHandler
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from tracehaven import Client
import pytest

@pytest.fixture
def receiver():
    received=[]
    class Handler(BaseHTTPRequestHandler):
        def do_POST(self):
            received.append(json.loads(self.rfile.read(int(self.headers['Content-Length']))))
            self.send_response(503 if len(received)==1 else 200);self.end_headers()
        def log_message(self,*args): pass
    server=HTTPServer(('127.0.0.1',0),Handler)
    thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
    yield f'http://127.0.0.1:{server.server_port}',received
    server.shutdown();server.server_close();thread.join()


def test_retry_identity_and_nested_spans(receiver):
    endpoint,received=receiver
    with Client(endpoint) as client:
        with client.run('Agent',input={'password':'secret','email':'me@example.com'}) as run:
            with client.span('parent'):
                with client.span('child',input={'api_key':'secret'}) as span:
                    span.set_output('Bearer private-key')
            run.set_output('done')
        assert client.flush()
    assert len(received)==2
    assert received[0]==received[1]
    payload=received[0][0]
    assert 'secret' not in json.dumps(payload)
    assert 'private-key' not in json.dumps(payload)
    assert payload['steps'][1]['parent_span_id']==payload['steps'][0]['span_id']


def test_async_concurrent_contexts(receiver):
    endpoint,received=receiver
    async def execute():
        async with Client(endpoint) as client:
            async def agent(name):
                async with client.run(name):
                    async with client.span('root'):
                        async def child(i):
                            async with client.span(str(i)):
                                await asyncio.sleep(.001)
                        await asyncio.gather(child(1),child(2))
            await asyncio.gather(agent('A'),agent('B'))
    asyncio.run(execute())
    unique={r[0]['run_id']:r[0] for r in received}
    assert len(unique)==2
    for payload in unique.values():
        root=payload['steps'][0]['span_id']
        assert all(s['parent_span_id']==root for s in payload['steps'][1:])


def test_exception_preserved_and_redactor_failure_never_escapes():
    def broken(value): raise RuntimeError('redaction failed')
    with Client('http://127.0.0.1:1',redactor=broken) as client:
        with pytest.raises(ValueError,match='application error'):
            with client.run('Agent'):
                with client.span('tool'):raise ValueError('application error')
        assert client.dropped==1


def test_unavailable_ingestion_is_bounded():
    import time
    start=time.monotonic()
    with Client('http://127.0.0.1:1',timeout=.1) as client:
        with client.run('Agent'):pass
        assert client.flush(timeout=2)
        assert client.dropped==1
    assert time.monotonic()-start<3


def test_capture_disabled_and_exception_recorded(receiver):
    endpoint,received=receiver
    with Client(endpoint,capture_payloads=False) as client:
        with pytest.raises(ValueError):
            with client.run('Agent',input='private data'):
                with client.span('tool',input='private data'):
                    raise ValueError('private data')
        assert client.flush()
    payload=received[-1][0]
    assert payload['success'] is False
    assert payload['steps'][0]['status']=='failure'
    assert 'private data' not in json.dumps(payload)
