"""Regenerate recorded artifacts from executable fixtures; no provider/network calls."""
import json
import sys
import hashlib
from pathlib import Path
from datetime import datetime, timedelta
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT/'backend'))
from app.evaluation import CASES, CHECK_VERSION, PROMPTS, simulate, evaluate, suite
from app import schemas

runs, seeds, reports = [], [], {}
start = datetime(2026, 10, 1, 10)
for vi, version in enumerate(['baseline','faulty','repaired'],1):
    for i,case in enumerate(CASES):
        result = simulate(case, version)
        check = evaluate(case,result)
        rid = f'{version}-{case["id"]}'
        ts = start + timedelta(hours=vi,minutes=i)
        timestamp = ts.isoformat()+'Z'
        retrieval_ms = 5000 if result['tool_status']=='timeout' else 180+i*7
        latency = retrieval_ms + 740+i*11
        evaluations = [dict(evaluator_name=name,score=float(passed),feedback=f'{"Passed" if passed else "Failed"} fixture check: {name.replace("_"," ")}',check_version=CHECK_VERSION,method='deterministic') for name,passed in check['checks'].items()]
        def step(sid,name,kind,offset,duration,parent=None,**rest):
            return dict(span_id=sid,parent_span_id=parent,step_name=name,kind=kind,status='success',started_at=(ts+timedelta(milliseconds=offset)).isoformat()+'Z',ended_at=(ts+timedelta(milliseconds=offset+duration)).isoformat()+'Z',latency_ms=duration,tokens=0,step_order=offset,tool_calls=[],attributes={},**rest)
        steps=[step('agent','Knowledge assistant','agent',0,latency,input=case['input'],output=result['answer']),
               step('retrieve','Retrieve knowledge','retrieval',0,retrieval_ms,'agent',input=json.dumps({'query':case['input'],'top_k':1 if version=='faulty' else 3}),output=json.dumps(result['documents'])),
               step('compose','Compose grounded answer','llm',retrieval_ms,latency-retrieval_ms,'agent',input=PROMPTS[version],output=result['answer'])]
        steps[1]['status']='failure' if result['tool_status']!='success' else 'success'
        steps[1]['attributes']={'documents':result['documents'],'tool_status':result['tool_status']}
        steps[1]['tool_calls']=[dict(tool_name='search_knowledge',tool_input=steps[1]['input'],tool_output=steps[1]['output'],status=steps[1]['status'],latency_ms=retrieval_ms)]
        steps[2]['tokens']=250+i*3
        payload=dict(run_id=rid, version=version, agent_name='KnowledgeAssistant', project_name='Knowledge assistant',workspace_name='Tracehaven demo',user_email='demo@example.test',timestamp=timestamp,success=result['execution_success'],latency_ms=latency,cost_cents=0,input_text=case['input'],output_text=result['answer'],steps=steps,evaluations=evaluations,case_id=case['id'],model='scripted reference agent',prompt_version=f'knowledge/{version}',source='simulated')
        if not result['execution_success']:
            payload['error_details']=dict(error_type='ToolTimeout',message='Simulated search_knowledge timeout after 5000ms.')
        schemas.IngestRunPayload.model_validate(payload)
        seeds.append(payload)
        response=dict(id=rid,timestamp=timestamp,created_at=timestamp,success=payload['success'],latency_ms=latency,cost_cents=0,input_hash=hashlib.sha256(case['input'].strip().lower().encode()).hexdigest(),input_text=case['input'],output_text=result['answer'],version_id=vi,version_tag=version,version=dict(id=vi,agent_id=1,version_tag=version,created_at=timestamp),agent_name='KnowledgeAssistant',project_name='Knowledge assistant',case_id=case['id'],model=payload['model'],prompt_version=payload['prompt_version'],source='simulated',quality='passed' if check['passed'] else 'failed',steps=[],errors=[],metrics=[],evaluations=[],failure_analysis=None)
        for j,s in enumerate(steps,1):
            tools=[dict(**t,id=j,step_id=j,created_at=timestamp) for t in s['tool_calls']]
            response['steps'].append(dict(**{k:v for k,v in s.items() if k!='tool_calls'},id=j,run_id=rid,created_at=timestamp,tool_calls=tools,errors=[]))
        response['evaluations']=[dict(**e,id=j,run_id=rid,created_at=timestamp) for j,e in enumerate(evaluations,1)]
        if payload.get('error_details'):
            response['errors']=[dict(**payload['error_details'],id=1,run_id=rid,created_at=timestamp)]
        schemas.RunDetailResponse.model_validate(response)
        runs.append(response)
        if version=='faulty' and not check['passed']:
            cause={'retrieval':'The retriever returned one document and missed a policy constraint. The prompt encouraged guessing instead of checking the evidence.', 'timeout':'The knowledge tool timed out. The agent produced an unsupported answer rather than retrying once or abstaining.', 'missing':'The evidence is empty, but the prompt encourages the agent to fill in missing facts.', 'conflict':'The documents conflict. The agent selected one answer without acknowledging the unresolved contradiction.', 'malformed':'The knowledge tool returned an invalid result. The agent invented an answer instead of failing safely.', 'injection':'The agent followed an instruction embedded in an untrusted retrieved document.'}[case['category']]
            proposal=dict(probable_cause=cause,evidence_span_ids=['retrieve','compose'],uncertainty='This diagnosis is authored from a controlled fixture. It does not establish behavior on unseen inputs or a live model.',prompt=PROMPTS['repaired'],retrieval_top_k=3,retry_count=1)
            schemas.Proposal.model_validate(proposal)
            reports[rid]=dict(source='simulated',investigator_version='investigator/1',check_version=CHECK_VERSION,model='scripted reference agent',proposal=proposal,before=suite('faulty'),after=suite('repaired'),baseline_source='simulated faulty reference agent',candidate_source='simulated repaired reference agent',remaining_failures=[],new_regressions=[],model_calls=0,tokens=0,cost_cents=0,decision='Developer review required. No production changes were made.')
artifact=dict(runs=runs,reports=reports,scores={v:sum(c['passed'] for c in suite(v)) for v in ['baseline','faulty','repaired']},case_count=len(CASES),check_version=CHECK_VERSION)
(ROOT/'frontend/src/lib/recorded.json').write_text(json.dumps(artifact,indent=2)+'\n')
(ROOT/'seed_data.json').write_text(json.dumps(seeds,indent=2)+'\n')
print(json.dumps(artifact['scores']))
