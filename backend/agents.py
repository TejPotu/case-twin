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

litellm.success_callback = ["langsmith"]
litellm.set_verbose = True

print(f"[LangSmith] Tracing enabled: LANGCHAIN_TRACING_V2={os.getenv('LANGCHAIN_TRACING_V2')}")
print(f"[LangSmith] Project: {os.getenv('LANGCHAIN_PROJECT')}")
print(f"[LangSmith] API Key configured: {'Yes' if os.getenv('LANGCHAIN_API_KEY') else 'No'}")


@tool("YouCom Search Tool")
def you_search_tool(query: str) -> str:
    """
    Search the internet for medical information about physicians, hospital staff and specialist directories.
    Returns page titles, URLs, and content snippets. Read the snippets carefully — they often
    contain doctor names like 'Dr. Jane Smith, MD — Pulmonologist at Hospital X'.
    Args:
        query (str): The search query (e.g. 'Dr Jane Smith pulmonologist Mayo Clinic profile')
    """
    api_key = os.getenv("YDC_API_KEY")
    if not api_key:
        return "Error: YDC_API_KEY environment variable is missing."

    headers = {"X-API-Key": api_key}
    try:
        print(f"[SpecialistAgent] YouCom search: {query}")
        res = requests.get(
            "https://ydc-index.io/v1/search",
            headers=headers,
            params={"query": query, "count": 10},
        )
        data = res.json()

        # URL patterns that indicate individual doctor profiles (server-rendered, content-rich)
        profile_patterns = [
            "/doctor/", "/physician/", "/provider/", "/faculty/", "/staff/",
            "/find-a-doctor/", "/our-team/", "/profile/", "/bio/",
            "/physicians/", "/doctors/", "/specialists/", "/expert/",
        ]
        # URL patterns that are likely useless for finding doctors
        skip_patterns = [
            "/news/", "/blog/", "/events/", "/careers/", "/jobs/",
            "/location/", "/condition/", "/treatment/", "/service/",
        ]

        results = []
        hits = data.get("hits", []) or data.get("results", {}).get("web", [])

        for hit in hits:
            url = hit.get("url", "")
            title = hit.get("title", "")
            snippets = hit.get("snippets", [])
            description = hit.get("description", "")
            full_text = (title + " " + description + " " + " ".join(snippets)).lower()

            score = 0
            if any(p in url.lower() for p in profile_patterns):
                score += 3
            if any(p in url.lower() for p in skip_patterns):
                score -= 2
            # Snippets mentioning a named doctor are gold
            if "dr." in full_text or " m.d." in full_text or ", md" in full_text:
                score += 3
            if any(w in full_text for w in ["physician", "specialist", "surgeon", "faculty", "board certified"]):
                score += 1

            content = description or " ".join(snippets)
            results.append({
                "score": score,
                "text": (
                    f"[SCORE:{score}]\n"
                    f"TITLE: {title}\n"
                    f"URL: {url}\n"
                    f"CONTENT: {content}\n"
                ),
            })

        results.sort(key=lambda x: x["score"], reverse=True)
        texts = [r["text"] for r in results]
        print(f"[SpecialistAgent] {len(texts)} results (ranked by relevance).")
        return "\n\n---\n\n".join(texts) if texts else "No results found."
    except Exception as e:
        print(f"[SpecialistAgent] Search failed: {e}")
        return f"Search failed: {str(e)}"


@tool("JS-Aware Web Page Reader")
def web_reader_tool(url: str) -> str:
    """
    Read any web page — including JavaScript-rendered hospital directories and doctor profile pages.
    Uses Jina.ai to fully render the page before returning clean markdown content.
    Always prefer this over any other scraping tool.
    Args:
        url (str): The full URL to read (e.g. 'https://hospital.com/find-a-doctor/pulmonology')
    """
    try:
        jina_url = f"https://r.jina.ai/{url}"
        resp = requests.get(
            jina_url,
            headers={
                "Accept": "text/markdown",
                "X-Return-Format": "markdown",
                "X-Timeout": "30",
            },
            timeout=35,
        )
        content = resp.text.strip()
        # Cap at 6000 chars to stay within LLM context limits
        if len(content) > 6000:
            content = content[:6000] + "\n...[content truncated]"
        print(f"[WebReader] Read {len(content)} chars from {url}")
        return content if content else "Page returned no readable content."
    except Exception as e:
        return f"Failed to read {url}: {str(e)}"


def analyze_hospital_staff(url: str, diagnosis: str, hospital_name: str, location: str = "") -> list:
    """
    Two-agent CrewAI crew: researcher finds physicians, extractor structures the data.
    Returns up to 5 dicts: name, specialty, credentials, context, url, phone.
    """
    print(f"[SpecialistAgent] Starting crew for '{hospital_name}' | diagnosis: '{diagnosis}'")

    from langsmith import traceable

    google_api_key = os.getenv("GEMINI_API_KEY")
    if not google_api_key:
        print("Warning: GEMINI_API_KEY not found.")

    llm = LLM(
        model="gemini/gemini-2.5-flash",
        api_key=google_api_key,
        temperature=0.1,
    )

    hospital_domain = url.split("/")[2] if url and "://" in url else hospital_name

    # ── Agent 1: Medical Intelligence Researcher ─────────────────────────────
    researcher = Agent(
        role="Medical Intelligence Researcher",
        goal=(
            f"Find the real names, credentials, and direct profile URLs of physicians at "
            f"{hospital_name} who treat or specialise in {diagnosis}."
        ),
        backstory=(
            f"You are a specialist medical researcher. You know that hospital homepages never "
            f"list doctors — you must go deeper. Your most important insight: YouCom search result "
            f"SNIPPETS often already contain physician names like 'Dr. Jane Smith, MD, specializes "
            f"in {diagnosis} at {hospital_name}' — read every snippet carefully and extract names "
            f"directly before deciding to read any pages. "
            f"When you need to read a page, use the JS-Aware Web Page Reader — it fully renders "
            f"JavaScript so hospital 'Find a Doctor' pages and physician directory listings work "
            f"correctly. Target INDIVIDUAL doctor profile pages for the richest data: full bio, "
            f"credentials, board certifications, phone number, and accepting-patients status."
        ),
        tools=[you_search_tool, web_reader_tool],
        verbose=True,
        llm=llm,
        max_iter=8,
    )

    # ── Agent 2: Precision Data Extractor ────────────────────────────────────
    extractor = Agent(
        role="Precision Medical Data Extractor",
        goal=(
            f"Produce a clean JSON list of 3–5 physicians relevant to {diagnosis} "
            f"from the researcher's report."
        ),
        backstory=(
            "You are a precision data extractor. You never hallucinate doctor names. "
            "You only include physicians whose full last names appear in the research report. "
            "For each physician you extract: full name with title, exact specialty, all "
            "credentials (MD, PhD, FACS, board certifications), a one-sentence clinical context, "
            "direct profile URL, and phone number. If fewer than 3 real physicians were found, "
            "you supplement with the most relevant specialty departments from the report."
        ),
        verbose=True,
        llm=llm,
    )

    # ── Task 1: Deep physician research ──────────────────────────────────────
    research_task = Task(
        description=f"""
Find real physicians who treat **{diagnosis}** at **{hospital_name}** (domain: {hospital_domain}).

Work through these steps IN ORDER. Stop once you have 3+ named physicians with credentials.

---
**STEP 1 — Read snippets for instant doctor names (no scraping needed):**
Search: `"{hospital_name}" "{diagnosis}" physician specialist doctor`
→ Read EVERY snippet and title carefully. They frequently contain gold like:
  "Dr. Alan M. Smith, MD, FCCP — Interventional Pulmonologist at {hospital_name}..."
→ Write down every doctor name, credential, and specialty you find in the snippets.

---
**STEP 2 — Find the physician directory / Find-a-Doctor page:**
Search: `"{hospital_name}" find a doctor {diagnosis} specialist physician directory`
→ From the results, identify 2 URLs that look like physician directory pages:
  (e.g. /find-a-doctor/, /our-providers/, /physician-directory/, /doctors/)
→ DO NOT scrape directory listing pages — they are JavaScript-rendered and return nothing.
→ Instead, look at the snippets for any doctor names mentioned.

---
**STEP 3 — Scrape individual doctor profile pages:**
Search: `site:{hospital_domain} {diagnosis} physician biography profile credentials`
OR: `"{hospital_name}" {diagnosis} doctor biography "board certified" OR "MD" OR "fellowship"`
→ Look for URLs to INDIVIDUAL doctor profiles (deep URLs like /doctor/firstname-lastname)
→ Read 2–3 of these individual profile pages with JS-Aware Web Page Reader
→ Individual profiles have: full name, MD/PhD credentials, board certifications, bio, phone

---
**STEP 4 — Fallback (only if steps 1–3 yield fewer than 3 doctors):**
Search: `"{hospital_name}" {diagnosis} department head chief specialist {location}`
→ Extract any department names, division chiefs, or program directors found.

Compile a detailed report with everything you found: names, credentials, specialties, URLs, phones.
""",
        expected_output=(
            "A detailed report listing physician names with credentials, specialties, profile URLs, "
            "and contact information found at the hospital for the diagnosis. Include raw text "
            "snippets that mention specific doctor names."
        ),
        agent=researcher,
    )

    # ── Task 2: Structured JSON extraction ───────────────────────────────────
    extract_task = Task(
        description=f"""
Read the researcher's report and extract physician data into a clean JSON array.

**Rules:**
- Only include individuals with a real last name found in the report (no generic "Specialist" entries)
- "name": Full name with title — e.g. "Dr. Sarah Johnson" (never just a department name alone)
- "specialty": Precise specialty relevant to {diagnosis} — e.g. "Interventional Pulmonology"
- "credentials": All credentials and certifications — e.g. "MD, FCCP, Board Certified Pulmonologist"
- "context": One sentence with the most relevant clinical fact — e.g. "Performs 200+ bronchoscopies annually and leads the lung nodule clinic"
- "url": The physician's OWN profile page URL found in the report (e.g. /doctor/jane-smith or /physician/12345).
  If no specific profile URL was found for this individual, fall back to the hospital URL: "{url}"
- "phone": Phone number if found, else empty string ""

**Output size:** Return 3 to 5 objects. If fewer than 3 named physicians were found, add the most relevant specialty departments or programs as entries (using department name as "name", "Department" as credentials).

Output ONLY the raw JSON array — no markdown, no preamble:
[{{"name": "...", "specialty": "...", "credentials": "...", "context": "...", "url": "...", "phone": ""}}]
""",
        expected_output="A JSON array of 3–5 physician/department objects with all required fields.",
        agent=extractor,
        context=[research_task],
    )

    crew = Crew(
        agents=[researcher, extractor],
        tasks=[research_task, extract_task],
        process=Process.sequential,
        verbose=True,
    )

    @traceable(
        name="hospital_specialist_extraction",
        project_name="casetwin",
        metadata={"hospital": hospital_name, "diagnosis": diagnosis, "location": location, "url": url},
    )
    def run_crew():
        return crew.kickoff()

    try:
        result = run_crew()
        output_str = getattr(result, "raw", str(result)).strip()

        for prefix in ("```json", "```"):
            if output_str.startswith(prefix):
                output_str = output_str[len(prefix):]
        if output_str.endswith("```"):
            output_str = output_str[:-3]
        output_str = output_str.strip()

        data = json.loads(output_str)
        if isinstance(data, list):
            return data[:5]
        return []
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"[SpecialistAgent] Extraction failed: {e}")
        return []
