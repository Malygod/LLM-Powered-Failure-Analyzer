# OMNI Python SDK

Install from this repository: `pip install ./sdk`. No registry release is implied.

```python
from omni import Client

with Client() as client:
    with client.run("MyAgent", input="question", version="v1") as run:
        with client.span("retrieve", kind="tool", input={"query": "question"}) as span:
            span.set_output({"documents": ["guide"]})
        run.set_output("answer", cost_cents=0)
        run.evaluate("grounded", True, "Reviewed against guide", check_version="grounded/1")
```

Use `async with` for clients, runs, and spans in async applications. Context variables isolate concurrent tasks and runs. Child tasks inherit their parent's current span. Finish child tasks before leaving the enclosing run; spans created after run export are not included.

`Client(redactor=your_function, capture_payloads=False)` controls payload export. The default redactor masks email addresses, bearer strings, and dictionary keys containing password/secret/token/api_key/authorization. It is not a complete PII detector. Serialization/redaction/export failures increment `client.dropped`, without replacing application exceptions.

Completed runs enter an in-memory queue (default 100). A daemon exporter sends each serialized payload at most three times with exponential delay. Retries reuse identical run IDs and bytes. The API treats exact repeats as idempotent and rejects changed content. HTTP 4xx other than 429 are not retried.

`flush(timeout=2)` returns whether queued deliveries finished. `close(timeout=2)` bounds shutdown waiting. This best-effort client does not persist events across process crashes; a daemon may still finish a bounded request after close times out. Inspect `dropped` and use your own operational telemetry when delivery guarantees matter.

Run IDs are generated UUIDs. Nested span timestamps and latency come from wall and monotonic clocks respectively. Token usage, cost and quality checks are explicitly supplied by the caller; the SDK does not invent provider usage or auto-instrument model libraries.

Installable distribution: `omni-agent-sdk`. Existing `from tracehaven import Client` and `from causelab import Client` integrations remain compatible.
