import os
from dotenv import load_dotenv
load_dotenv()

# Set LangChain/LangSmith environment variables BEFORE importing crewai
os.environ["LANGCHAIN_TRACING_V2"] = "true"
os.environ["LANGCHAIN_PROJECT"] = "casetwin"
if not os.getenv("LANGCHAIN_API_KEY"):
    print("WARNING: LANGCHAIN_API_KEY not found - LangSmith tracing will not work!")

import json
import requests
import litellm
from crewai import Agent, Task, Crew, Process, LLM
from crewai.tools import tool
from crewai_tools import ScrapeWebsiteTool

# Enable LangSmith tracing for LiteLLM
litellm.success_callback = ["langsmith"]
litellm.set_verbose = True  # Enable verbose logging to see callback execution

# Verify LangSmith configuration
print(f"[LangSmith] Tracing enabled: LANGCHAIN_TRACING_V2={os.getenv('LANGCHAIN_TRACING_V2')}")
print(f"[LangSmith] Project: {os.getenv('LANGCHAIN_PROJECT')}")
print(f"[LangSmith] API Key configured: {'Yes' if os.getenv('LANGCHAIN_API_KEY') else 'No'}")

@tool("YouCom Search Tool")
def you_search_tool(query: str) -> str:
    """Useful to search the internet for specific medical information, like finding doctors, reviews, or news.
    Args:
        query (str): The search query phrase (e.g. 'Top Thoracic surgeons at Mayo Clinic')
    """
    api_key = os.getenv("YDC_API_KEY")
    if not api_key: return "Error: YDC_API_KEY environment variable is missing."

    headers = {"X-API-Key": api_key}
    try:
        print(f"[SpecialistAgent] Searching YouCom for: {query}")
        res = requests.get(
            "https://ydc-index.io/v1/search",
            headers=headers,
            params={"query": query, "count": 10}  # Increased from 5 to 10 for more options
        )
        data = res.json()
        snippets = []

        # Define patterns that indicate doctor/faculty directories
        good_url_patterns = ['/doctor', '/physician', '/faculty', '/specialist', '/staff',
                            '/find-a-doctor', '/our-team', '/provider', '/medical-staff']
        bad_url_patterns = ['/news/', '/blog/', '/patient', '/location', '/contact', '/about',
                           '/service', '/treatment', '/condition']

        for hit in data.get("hits", []):
            url = hit.get('url', '').lower()
            title = hit.get('title', '')

            # Score URLs based on how likely they are to contain doctor directories
            score = 0
            if any(pattern in url for pattern in good_url_patterns):
                score += 2
            if any(pattern in url for pattern in bad_url_patterns):
                score -= 1
            if any(word in title.lower() for word in ['doctor', 'physician', 'faculty', 'specialist', 'md', 'provider']):
                score += 1

            snippets.append({
                'score': score,
                'text': f"[RELEVANCE: {score}] Title: {title}\nURL: {hit.get('url')}\nSnippets: {' '.join(hit.get('snippets', []))}"
            })

        if not snippets:
             # Try fallback to /v1/search structure
             for hit in data.get("results", {}).get("web", []):
                 url = hit.get('url', '').lower()
                 title = hit.get('title', '')
                 score = 0
                 if any(pattern in url for pattern in good_url_patterns):
                     score += 2
                 if any(pattern in url for pattern in bad_url_patterns):
                     score -= 1
                 snippets.append({
                     'score': score,
                     'text': f"[RELEVANCE: {score}] Title: {title}\nURL: {hit.get('url')}\nSnippets: {' '.join(hit.get('snippets', []))}"
                 })

        # Sort by relevance score (highest first)
        snippets.sort(key=lambda x: x['score'], reverse=True)
        result_texts = [s['text'] for s in snippets]

        print(f"[SpecialistAgent] Found {len(snippets)} search results (sorted by relevance).")
        return "\n\n".join(result_texts) if result_texts else "No search results found."
    except Exception as e:
        print(f"[SpecialistAgent] Search failed: {e}")
        return f"Search failed: {str(e)}"

def analyze_hospital_staff(url: str, diagnosis: str, hospital_name: str, location: str = "") -> list:
    """
    CrewAI orchestrator to search for and scrape a hospital for relevant doctors/programs.
    Returns a list of dictionaries with 'name', 'specialty', 'context'.
    """
    print(f"[SpecialistAgent] Orchestrating crew for {hospital_name} in {location}...")

    # Import LangSmith tracing
    from langsmith import traceable

    google_api_key = os.getenv("GEMINI_API_KEY")
    if not google_api_key:
         print("Warning: GEMINI_API_KEY not found in env.")

    llm = LLM(
        model="gemini/gemini-2.5-flash",
        api_key=google_api_key,
        temperature=0.1
    )

    scrape_tool = ScrapeWebsiteTool() # Dynamic URL

    recon_agent = Agent(
        role='Medical Researcher & Investigator',
        goal=f'Find specific doctors, specialists, or clinical trials for {diagnosis} at {hospital_name}.',
        backstory=f'You are an elite medical researcher who digs deep to find doctor information. You understand that hospital homepages rarely list doctors directly. You use the YouCom Search Tool to find specialist directories, faculty pages, and department listings. You look for URLs with paths like "/doctors/", "/physicians/", "/faculty/", "/specialists/", or "/staff/". You prioritize deeper pages that actually list doctor names, not just overview pages. You are persistent and will scrape multiple pages to build a comprehensive list of specialists for {diagnosis}.',
        tools=[you_search_tool, scrape_tool],
        verbose=True,
        llm=llm
    )

    extraction_agent = Agent(
        role='Data Extraction Expert',
        goal=f'Take the research report and extract exact names of doctors and programs related to {diagnosis}.',
        backstory='You are a precision data-extraction tool. You read raw text and identify exactly who the relevant doctors or departments are for a specific disease. You always return strictly formatted JSON arrays.',
        verbose=True,
        llm=llm
    )

    scrape_task = Task(
        description=f'''
        You need to find actual doctors who treat {diagnosis} at {hospital_name}. Use multiple targeted searches to find faculty directories:

        1. First, search for: "{hospital_name} {diagnosis} doctors faculty directory site:{url.split('/')[2] if url else hospital_name}"
           This targets the hospital's own doctor directory pages.

        2. If that doesn't yield good results, try: "{hospital_name} find a doctor {diagnosis}"
           This often finds the hospital's "Find a Doctor" search tool.

        3. Also try: "{hospital_name} department faculty {diagnosis}"
           This targets academic medical center faculty pages.

        4. From the search results, identify URLs that contain these patterns:
           - /doctors/, /physicians/, /faculty/, /specialists/, /staff/, /find-a-doctor/
           - /our-team/, /meet-our-doctors/, /provider-directory/
           - Avoid: /about/, /contact/, /news/, /patient-info/, /locations/

        5. Use the ScrapeWebsiteTool to scrape up to 4 of the most promising URLs. Prioritize:
           - URLs with specific department names in the path
           - URLs that are 3+ levels deep (e.g., /departments/cardiology/doctors/)
           - URLs from the hospital's own domain

        6. If you find a directory page but it doesn't list doctors directly, look for links within that page to individual doctor profiles and scrape 1-2 of those.

        7. Compile a comprehensive report with all doctors, their specialties, credentials, and any contact information you found.
        ''',
        expected_output='A comprehensive text report detailing specific doctors, specialties, credentials, and contact/program info found for treating the diagnosis at the hospital.',
        agent=recon_agent
    )

    extract_task = Task(
        description=f'''
        Read the provided researcher's report and extract leading doctors, specialists, or key departments treating {diagnosis}.
        If you cannot find exact doctors, extract the relevant department or clinical trial information.
        Your output MUST be a valid JSON array of objects. Do not include markdown code block syntax (like ```json).
        Each object should have:
        - "name": String (e.g., "Dr. Alan Smith" or "Thoracic Surgery Dept")
        - "specialty": String (e.g., "Pulmonary Specialist")
        - "context": String (e.g., "Board Certified Cardiologist with 15 years experience")
        - "url": String (the doctor's profile URL if found in the report, otherwise use the hospital URL: "{url}")
        - "phone": String (phone number if found, otherwise empty string "")

        If no specific doctors are found, return information about the relevant department or hospital contact:
        - Use the hospital name as "name"
        - Use the department as "specialty"
        - Provide helpful context like "Contact the {diagnosis} department for specialist referrals"
        - Include the main hospital URL

        Return ONLY the raw JSON array string.
        ''',
        expected_output='A JSON array of objects detailing the found specialists/departments with their profile URLs.',
        agent=extraction_agent,
        context=[scrape_task]
    )

    crew = Crew(
        agents=[recon_agent, extraction_agent],
        tasks=[scrape_task, extract_task],
        process=Process.sequential,
        verbose=True
    )

    # Wrap crew execution with LangSmith tracing
    @traceable(
        name="hospital_specialist_extraction",
        project_name="casetwin",
        metadata={
            "hospital": hospital_name,
            "diagnosis": diagnosis,
            "location": location,
            "url": url
        }
    )
    def run_crew_with_tracing():
        return crew.kickoff()

    # Run the crew
    try:
        result = run_crew_with_tracing()
        output_str = getattr(result, 'raw', str(result)).strip()

        # Strip potential markdown formatting if the LLM leaked it
        if output_str.startswith("```json"):
            output_str = output_str[7:]
        if output_str.startswith("```"):
            output_str = output_str[3:]
        if output_str.endswith("```"):
            output_str = output_str[:-3]
        output_str = output_str.strip()

        data = json.loads(output_str)
        if isinstance(data, list):
             # Ensure we don't send too many to the UI if it hallucinated 50 docs
            return data[:5]
        return []
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Agent Extraction failed: {e}")
        return []
