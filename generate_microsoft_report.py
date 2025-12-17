import os
import re

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
        raw_desc = content[desc_start + 14:].strip()
        lines = [line for line in raw_desc.split('\n') if not line.startswith("**Status:**") and not line.startswith("**Download Link:**")]
        description = "\n".join(lines).strip()
    
    return {
        "title": title,
        "publisher": publisher,
        "filename": os.path.basename(file_path),
        "votes": votes,
        "rating": rating,
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

    microsoft_plugins = []
    for p in plugins:
        if "microsoft" in p["publisher"].lower():
            microsoft_plugins.append(p)
            
    # Sort by Score
    microsoft_plugins.sort(key=lambda x: x["score"], reverse=True)

    report_lines = []
    report_lines.append("# Microsoft-Published Excel Plugins Report\n")
    report_lines.append("This report lists all Excel plugins published by Microsoft, ranked by 'Impact Score' (Rating × Votes).\n\n")

    if not microsoft_plugins:
        report_lines.append("No plugins found published by Microsoft.\n")
    else:
        report_lines.append("| Rank | Name | Score | Rating | Votes | Description Summary |")
        report_lines.append("|---|---|---|---|---|---|")
        for i, p in enumerate(microsoft_plugins):
            summary = p["description"][:150].replace('\n', ' ') + "..." if len(p["description"]) > 150 else p["description"]
            report_lines.append(f"| {i+1} | {p['title']} | {p['score']:.1f} | {p['rating']} | {p['votes']} | {summary} |")

    with open("MICROSOFT_PLUGINS_REPORT.md", "w", encoding='utf-8') as f:
        f.write("\n".join(report_lines))
    
    print("Report generated: MICROSOFT_PLUGINS_REPORT.md")

if __name__ == "__main__":
    main()
