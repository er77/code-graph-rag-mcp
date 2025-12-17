import os
import re
import math
from collections import defaultdict

# Configuration: Keywords for Classification
CATEGORIES = {
    "AI & LLM": ["gpt", "openai", "ai ", "artificial intelligence", " machine learning", "copilot", "chatgpt", "generative", "nlp", "bot"],
    "Database & SQL": ["sql", "database", "query", "postgres", "mysql", "oracle", "mongodb", "azure data", "bigquery", "snowflake", "data connector"],
    "Data Visualization": ["chart", "graph", "diagram", "plot", "dashboard", "visualize", "sankey", "gantt", "map", "infographic"],
    "Finance & Accounting": ["finance", "budget", "tax", "accounting", "ledger", "invoice", "payroll", "currency", "stock", "portfolio"],
    "Sales & CRM": ["crm", "salesforce", "hubspot", "marketing", "lead", "customer", "dynamics 365"],
    "Productivity & Utilities": ["template", "format", "merge", "utility", "automation", "converter", "pdf", "qr code", "barcode"]
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
    
    votes = int(votes_match.group(1)) if votes_match else 0
    rating = float(rating_match.group(1)) if rating_match else 0.0
    
    # Extract Description for keyword searching
    desc_start = content.find("## Description")
    description = content[desc_start:].lower() if desc_start != -1 else ""
    
    # Also search in the title
    search_text = (title + " " + description).lower()
    
    return {
        "title": title,
        "filename": os.path.basename(file_path),
        "votes": votes,
        "rating": rating,
        "search_text": search_text,
        "score": votes * rating  # Simple impact score
    }

def classify_plugin(plugin):
    tags = []
    for category, keywords in CATEGORIES.items():
        for keyword in keywords:
            if keyword in plugin["search_text"]:
                tags.append(category)
                break # Found one keyword for this category, move to next category
    return tags

def main():
    plugins = []
    
    files = [f for f in os.listdir(PLUGIN_DIR) if f.endswith('.md')]
    print(f"Analyzing {len(files)} plugins...")

    for file in files:
        path = os.path.join(PLUGIN_DIR, file)
        try:
            data = parse_markdown(path)
            data["tags"] = classify_plugin(data)
            plugins.append(data)
        except Exception as e:
            print(f"Error parsing {file}: {e}")

    # Sort by Score (Votes * Rating)
    plugins.sort(key=lambda x: x["score"], reverse=True)

    # Generate Report
    report_lines = []
    report_lines.append("# Excel Plugin Analysis Report\n")
    report_lines.append("This report classifies plugins by functionality and ranks them by 'Impact Score' (Rating × Votes).\n")

    # 1. Top Rated Overall
    report_lines.append("## 🏆 Top 20 Most Useful Plugins (Overall)\n")
    report_lines.append("| Rank | Name | Score | Rating | Votes | Categories |")
    report_lines.append("|---|---|---|---|---|---|")
    for i, p in enumerate(plugins[:20]):
        tags_str = ", ".join(p["tags"]) if p["tags"] else "General"
        report_lines.append(f"| {i+1} | {p['title']} | {p['score']:.1f} | {p['rating']} | {p['votes']} | {tags_str} |")
    
    report_lines.append("\n---\n")

    # 2. Top by Category
    for category in CATEGORIES.keys():
        category_plugins = [p for p in plugins if category in p["tags"]]
        category_plugins.sort(key=lambda x: x["score"], reverse=True)
        
        report_lines.append(f"## 📂 {category} (Top 10)\n")
        if not category_plugins:
            report_lines.append("_No plugins found matching this category._\n")
        else:
            report_lines.append("| Rank | Name | Score | Description Snippet |")
            report_lines.append("|---|---|---|---|")
            for i, p in enumerate(category_plugins[:10]):
                report_lines.append(f"| {i+1} | {p['title']} | {p['score']:.1f} | {p['filename']} |")
        report_lines.append("\n")

    # Write Report
    with open("PLUGIN_ANALYSIS_REPORT.md", "w", encoding='utf-8') as f:
        f.write("\n".join(report_lines))
    
    print(f"Analysis complete. Report saved to 'PLUGIN_ANALYSIS_REPORT.md'.")

if __name__ == "__main__":
    main()
