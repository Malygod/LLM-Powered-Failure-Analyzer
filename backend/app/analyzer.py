import logging
from openai import OpenAI
from sqlalchemy.orm import Session
from app.config import settings
from app import models

logger = logging.getLogger(__name__)

def get_openai_client() -> OpenAI | None:
    if not settings.openai_api_key or settings.openai_api_key == "your_api_key_here":
        return None
    return OpenAI(
        api_key=settings.openai_api_key,
        base_url=settings.openai_api_base
    )

def generate_mock_analysis(error_msg: str, step_name: str, step_output: str) -> tuple[str, str]:
    """Generates a smart mock response based on the error content if no API key is provided."""
    summary = "No API key configured. "
    fix = "Configure your OPENAI_API_KEY in the environment variables to use real LLM analysis."
    
    error_lower = error_msg.lower()
    step_lower = step_output.lower() if step_output else ""
    
    if "api_key" in error_lower or "unauthorized" in error_lower or "401" in error_lower:
        summary += f"The agent failed at step '{step_name}' due to authentication issues with an external API."
        fix = "Verify your external service credentials (API Keys, Tokens) in the environment variables."
    elif "db" in error_lower or "database" in error_lower or "connection" in error_lower:
        summary += f"The database query failed during the '{step_name}' step. Connection was refused or timed out."
        fix = "Ensure the database container/service is running and accessible from the backend environment."
    elif "timeout" in error_lower or "deadline" in error_lower:
        summary += f"The step '{step_name}' timed out before receiving a response from the model or tool call."
        fix = "Implement retry policies with exponential backoff or increase the execution timeout threshold."
    elif "empty" in step_lower or "none" in step_lower or "null" in step_lower:
        summary += f"The agent failed because a vital tool returned an empty or null output at step '{step_name}'."
        fix = "Add strict schema validation and null-checking for the tool output before passing it downstream."
    else:
        summary += f"The agent run failed during step '{step_name}' with the following error: {error_msg}"
        fix = "Inspect the tool inputs and wrap the step in a try-catch block to handle runtime exceptions gracefully."
        
    return summary, fix

def analyze_failure(db: Session, run_id: str) -> models.FailureAnalysis:
    # 1. Fetch the run
    run = db.query(models.Run).filter(models.Run.id == run_id).first()
    if not run:
        raise ValueError("Run not found")
        
    # Check if analysis already exists
    if run.failure_analysis:
        return run.failure_analysis
        
    # 2. Extract error information
    error_msg = "Unknown error occurred"
    stack_trace = None
    if run.errors:
        error_msg = run.errors[0].message
        stack_trace = run.errors[0].stack_trace
        
    # 3. Find the last executed step
    last_step_name = "Agent Entry"
    last_step_input = run.input_text
    last_step_output = run.output_text
    
    if run.steps:
        sorted_steps = sorted(run.steps, key=lambda s: s.step_order)
        last_step = sorted_steps[-1]
        last_step_name = last_step.step_name
        last_step_input = last_step.input
        last_step_output = last_step.output

    # 4. Attempt API-based Analysis
    client = get_openai_client()
    if client:
        try:
            prompt = f"""You are an expert AI agent debugger and Sira AI analyzer.
Analyze the following agent execution failure.

Error message: {error_msg}
Stack trace (if available): {stack_trace}

Last step detail:
Step Name: {last_step_name}
Input: {last_step_input}
Output: {last_step_output}

Provide a concise analysis including:
1. "Summary": What went wrong and why (1-2 sentences).
2. "Suggested Fix": Actionable advice to resolve this issue (1-2 sentences).

Your output must be structured exactly like this:
Summary: <Your summary here>
Suggested Fix: <Your suggested fix here>
"""
            response = client.chat.completions.create(
                model=settings.openai_model_name,
                messages=[
                    {"role": "system", "content": "You are a helpful engineering debugger assistant."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.1,
                max_tokens=250
            )
            content = response.choices[0].message.content or ""
            
            # Simple text parsing
            summary = "Failed to analyze error."
            suggested_fix = "Check logs and errors manually."
            
            for line in content.split("\n"):
                if line.startswith("Summary:"):
                    summary = line.replace("Summary:", "").strip()
                elif line.startswith("Suggested Fix:"):
                    suggested_fix = line.replace("Suggested Fix:", "").strip()
                    
            if summary == "Failed to analyze error." and content:
                # If structure not followed exactly, use raw text
                summary = content
                
        except Exception as e:
            logger.error(f"Error calling LLM: {str(e)}")
            summary, suggested_fix = generate_mock_analysis(error_msg, last_step_name, last_step_output)
            summary = f"[LLM Call Failed: {str(e)}] " + summary
    else:
        # Generate mock response
        summary, suggested_fix = generate_mock_analysis(error_msg, last_step_name, last_step_output)
        summary = "[Simulated AI Analyzer] " + summary

    # 5. Save to database
    analysis = models.FailureAnalysis(
        run_id=run_id,
        error_summary=summary,
        suggested_fix=suggested_fix
    )
    db.add(analysis)
    db.commit()
    db.refresh(analysis)
    
    return analysis
