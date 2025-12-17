import os
import re
from collections import defaultdict

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

    # Group by Publisher
    publisher_stats = defaultdict(lambda: {"total_score": 0, "plugins": []})
    
    for p in plugins:
        pub = p["publisher"]
        # Skip unknown or empty publishers if any
        if not pub or pub.lower() == "unknown":
            continue
            
        publisher_stats[pub]["total_score"] += p["score"]
        publisher_stats[pub]["plugins"].append(p)

    # Sort Publishers by Total Score
    sorted_publishers = sorted(publisher_stats.items(), key=lambda x: x[1]["total_score"], reverse=True)
    
    # Top 10
    top_10 = sorted_publishers[:10]

    report_lines = []
    report_lines.append("# Top 10 Excel Plugin Publishers Report\n")
    report_lines.append("This report identifies the top 10 publishers based on the cumulative 'Impact Score' (Rating × Votes) of all their plugins.\n")

    for rank, (pub_name, data) in enumerate(top_10, 1):
        report_lines.append(f"## {rank}. {pub_name}")
        report_lines.append(f"**Total Impact Score:** {data['total_score']:.1f}")
        report_lines.append(f"**Total Plugins:** {len(data['plugins'])}\n")
        
        report_lines.append("| Plugin Name | Score | Rating | Votes | Summary |")
        report_lines.append("|---|---|---|---|---|")
        
        # Sort their plugins by score
        my_plugins = sorted(data['plugins'], key=lambda x: x["score"], reverse=True)
        
        # List top 5 plugins for brevity, or all if few
        for p in my_plugins[:10]:
            summary = p["description"][:100].replace('\n', ' ') + "..." if len(p["description"]) > 100 else p["description"]
            report_lines.append(f"| {p['title']} | {p['score']:.1f} | {p['rating']} | {p['votes']} | {summary} |")
        
        if len(my_plugins) > 10:
            report_lines.append(f"| *...and {len(my_plugins) - 10} more* | | | | |")
            
        report_lines.append("\n---\n")

    with open("TOP_PUBLISHERS_REPORT.md", "w", encoding='utf-8') as f:
        f.write("\n".join(report_lines))
    
    print("Report generated: TOP_PUBLISHERS_REPORT.md")

if __name__ == "__main__":
    main()
