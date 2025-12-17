import os
import re

# Extended Taxonomy (30 Types)
CATEGORIES = {
    "1. AI & Generative Text": ["gpt", "openai", "ai ", "artificial intelligence", "llm", "chatbot", "copilot", "chatgpt", "text generation"],
    "2. Database & SQL Connectors": ["sql", "database", "query", "postgres", "mysql", "oracle", "mongodb", "azure data", "bigquery", "snowflake", "db2", "odbc"],
    "3. Data Visualization & Charts": ["chart", "graph", "diagram", "plot", "dashboard", "sankey", "gantt", "treemap", "histogram", "infographic"],
    "4. Finance & Stock Markets": ["stock", "market data", "ticker", "investment", "portfolio", "trading", "equity", "forex", "exchange rate", "bloomberg", "refinitiv"],
    "5. Cryptocurrency & Blockchain": ["crypto", "bitcoin", "ethereum", "blockchain", "coin", "token", "web3", "wallet"],
    "6. Accounting & Invoicing": ["accounting", "invoice", "ledger", "tax", "vat", "bookkeeping", "xero", "quickbooks", "sage", "expense"],
    "7. Project Management": ["project", "task", "kanban", "scrum", "agile", "gantt", "milestone", "timeline", "wbs", "jira", "trello", "asana"],
    "8. CRM & Customer Mgmt": ["crm", "customer relationship", "salesforce", "hubspot", "dynamics 365", "zoho", "pipedrive", "contact management"],
    "9. Sales & Marketing": ["sales", "marketing", "lead", "campaign", "funnel", "advertis", "seo", "mailchimp", "sem", "promotion"],
    "10. Maps & Geospatial": ["map", "gis", "geo", "location", "address", "coordinate", "latitude", "longitude", "bing maps", "google maps"],
    "11. Barcodes & QR Codes": ["barcode", "qr code", "scanner", "ean", "upc", "qrcode", "datamatrix"],
    "12. PDF & Document Mgmt": ["pdf", "document", "convert", "merge", "split", "adobe", "contract", "esign", "signature"],
    "13. Language & Translation": ["translat", "language", "dictionary", "thesaurus", "english", "spanish", "french", "german", "vocabulary"],
    "14. Math & Statistics": ["math", "statistic", "calculus", "algebra", "regression", "probability", "analysis", "formula", "solver"],
    "15. Education & Learning": ["education", "learn", "teach", "school", "student", "university", "training", "quiz", "course"],
    "16. HR & People": ["hr", "human resource", "employee", "payroll", "recruiting", "hiring", "personnel", "staff", "onboarding"],
    "17. Inventory & Supply Chain": ["inventory", "supply chain", "logistics", "warehouse", "stock", "shipping", "freight", "order"],
    "18. Time Tracking": ["time tracking", "timesheet", "clock", "timer", "attendance", "shift", "schedule"],
    "19. Weather & Environment": ["weather", "climate", "forecast", "temperature", "rain", "environmental", "carbon", "sustainability"],
    "20. Social Media": ["social media", "facebook", "twitter", "linkedin", "instagram", "youtube", "tiktok", "influencer"],
    "21. Email & Communication": ["email", "mail", "outlook", "message", "sms", "communication", "chat", "slack", "teams"],
    "22. Legal & Compliance": ["legal", "law", "compliance", "regulation", "gdpr", "policy", "attorney", "litigation"],
    "23. Real Estate": ["real estate", "property", "realtor", "housing", "mortgage", "tenant", "lease"],
    "24. Healthcare & Medical": ["health", "medical", "patient", "doctor", "clinic", "hospital", "pharmacy", "medicine"],
    "25. Reference & Lookups": ["wikipedia", "encyclopedia", "lookup", "reference", "search", "knowledge base"],
    "26. Security & Identity": ["security", "password", "auth", "identity", "verify", "protection", "encrypt", "cyber"],
    "27. Forms & Surveys": ["form", "survey", "poll", "questionnaire", "feedback", "response", "google forms", "typeform"],
    "28. E-commerce & Retail": ["ecommerce", "retail", "shop", "store", "shopify", "woocommerce", "amazon", "product"],
    "29. Energy & Utilities": ["energy", "utility", "power", "electricity", "gas", "water", "solar", "oil"],
    "30. Text Tools & Utilities": ["text", "string", "regex", "format", "clean", "duplicate", "case", "trim", "utility"]
}

PLUGIN_DIR = "excel_plugins"

def parse_markdown(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Extract Title
    title_match = re.search(r'^# (.+)$', content, re.MULTILINE)
    title = title_match.group(1) if title_match else "Unknown"

    # Extract Metadata
    votes_match = re.search(r'\*\*Rating:\*\* .*?\((\d+) votes\)', content)
    rating_match = re.search(r'\*\*Rating:\*\* ([\d\.]+)', content)
    publisher_match = re.search(r'\*\*Publisher:\*\* (.*)', content)
    
    votes = int(votes_match.group(1)) if votes_match else 0
    rating = float(rating_match.group(1)) if rating_match else 0.0
    publisher = publisher_match.group(1).strip() if publisher_match else "Unknown"
    
    # Extract Description
    desc_start = content.find("## Description")
    description = ""
    if desc_start != -1:
        # Get everything after "## Description"
        raw_desc = content[desc_start + 14:].strip()
        # Clean up common markdown noise or "Status:" lines
        lines = [line for line in raw_desc.split('\n') if not line.startswith("**Status:**") and not line.startswith("**Download Link:**")]
        description = "\n".join(lines).strip()
    
    search_text = (title + " " + description).lower()
    
    return {
        "title": title,
        "publisher": publisher,
        "filename": os.path.basename(file_path),
        "votes": votes,
        "rating": rating,
        "search_text": search_text,
        "description": description,
        "score": votes * rating
    }

def main():
    plugins = []
    
    # Load all plugins
    files = [f for f in os.listdir(PLUGIN_DIR) if f.endswith('.md')]
    for file in files:
        path = os.path.join(PLUGIN_DIR, file)
        try:
            plugins.append(parse_markdown(path))
        except Exception:
            continue

    report_lines = []
    report_lines.append("# Detailed 30-Category Excel Plugin Report\n")
    report_lines.append("This report identifies the most useful plugin for 30 distinct functional categories. **Uniqueness enforced: A plugin can only win one category.**\n")

    used_winners = set()

    for category, keywords in sorted(CATEGORIES.items()):
        # Filter plugins for this category
        matches = []
        for p in plugins:
            # Check keywords
            if any(k in p["search_text"] for k in keywords):
                matches.append(p)
        
        # Sort by Score
        matches.sort(key=lambda x: x["score"], reverse=True)
        
        report_lines.append(f"## {category}")
        
        if not matches:
            report_lines.append("_No plugins found matching this category._\n")
            continue

        # Find first unused winner
        top_plugin = None
        for p in matches:
            if p["title"] not in used_winners:
                top_plugin = p
                break
        
        # Fallback if all matches are already used (rare, but possible if a category has very few items and they are all dominant elsewhere)
        if not top_plugin:
            top_plugin = matches[0] # Reuse the best one if absolutely necessary, but add a note
            note = " *(Note: This plugin also won another category)*"
        else:
            used_winners.add(top_plugin["title"])
            note = ""

        # Extract a short summary (first 300 chars or first paragraph)
        full_desc = top_plugin["description"]
        summary = full_desc[:300].replace('\n', ' ') + "..." if len(full_desc) > 300 else full_desc
        
        report_lines.append(f"### 🏆 Winner: {top_plugin['title']}{note}")
        report_lines.append(f"- **Publisher:** {top_plugin['publisher']}")
        report_lines.append(f"- **Score:** {top_plugin['score']:.1f} (Rating: {top_plugin['rating']} | Votes: {top_plugin['votes']})")
        report_lines.append(f"- **Summary:** {summary}")
        report_lines.append(f"- **File:** `{top_plugin['filename']}`\n")
        
        # Optional: List Runner-up (Next unique one)
        runner_up = None
        for p in matches:
            if p["title"] != top_plugin["title"] and p["title"] not in used_winners:
                runner_up = p
                break
        
        if runner_up:
             report_lines.append(f"**Runner-up:** {runner_up['title']} ({runner_up['score']:.1f})")
        elif len(matches) > 1:
             # If we couldn't find a unique runner up, just list the next one even if used
             next_p = matches[1] if matches[0] == top_plugin else matches[0]
             report_lines.append(f"**Runner-up:** {next_p['title']} ({next_p['score']:.1f})")

        report_lines.append("\n---\n")

    with open("DETAILED_PLUGIN_REPORT_30_TYPES.md", "w", encoding='utf-8') as f:
        f.write("\n".join(report_lines))
    
    print("Report generated: DETAILED_PLUGIN_REPORT_30_TYPES.md")

if __name__ == "__main__":
    main()