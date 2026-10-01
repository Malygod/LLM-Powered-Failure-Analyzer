# Causelab walkthrough

Silent browser capture: `frontend/public/walkthrough.webm`. The interface contains its own labels; use the following short narration when recording a personal application video.

1. **Dashboard:** “This is Causelab, my AI reliability prototype. The public demo is recorded and simulated, so you can inspect it without an account.”
2. **Featured trace:** “The interesting failure is a run that succeeds technically but gives an unsupported answer. Here, retrieval returned the overview and missed the archive policy.”
3. **Inspector:** “Each step includes its timing, inputs, outputs, tool arguments, and evidence. Quality checks are separate from execution status.”
4. **Investigation:** “The proposed repair retrieves more evidence and abstains when it cannot verify a claim. The local live mode uses a bounded model-backed investigator; this example is explicitly recorded.”
5. **Results:** “On these 20 scripted fixtures, passing cases increase from eight to twenty. I can inspect each check and export the report. This does not establish performance on unseen data.”
6. **Engineering:** “Behind this are an installable Python SDK, idempotent ingestion, database migrations, and durable jobs with bounded retries. I kept production adoption under developer control.”

Adapt this wording to your own voice and explain the decisions you can defend. Do not claim real customers or live-model improvements from synthetic fixture results.
