"""Run after installing ./sdk. No model key required; example tool is simulated."""
from omni import Client

with Client() as client:
    with client.run('KnowledgeAssistant', input='Can I export logs older than 30 days?',
                    version='sdk-example', case_id='knowledge-09', prompt_version='knowledge/faulty') as run:
        with client.span('Retrieve knowledge', input={'query': 'log retention'}, attributes={'documents':['overview']}) as retrieval:
            retrieval.set_output({'id':'overview', 'text':'Standard logs are retained for 30 days.'})
        with client.span('Compose answer', kind='llm', input='Retrieved overview') as generation:
            answer = 'Yes, exports are always available for 90 days. [overview]'
            generation.set_output(answer)
        run.set_output(answer)
        run.evaluate('unsupported_claims', False, 'The retrieved evidence does not support 90-day retention.')
    print(f'Trace: {run.id}')
