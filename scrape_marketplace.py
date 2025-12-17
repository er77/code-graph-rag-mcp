
import requests
import json
import re
import time
import sys

# URLs to scrape

all_plugins = []
urls = []
for i in range(1, 26): # Scrape pages 1 to 25
    urls.append(f"https://marketplace.microsoft.com/en-us/marketplace/apps?product=office%3Bexcel&page={i}")



def fetch_and_parse(url):
    print(f"Fetching {url}...")
    try:
        response = requests.get(url)
        response.raise_for_status()
        content = response.text
    except Exception as e:
        print(f"Error fetching {url}: {e}")
        return

    # Extract JSON from window.__INITIAL_STATE__
    match = re.search(r'window\.__INITIAL_STATE__\s*=', content)
    if match:
        start_search_index = match.end()
        start_index = content.find('{', start_search_index)
        
        if start_index != -1:
            # We need to find the end of the JSON object. 
            # Simple brace counting is safer than regex for nested objects.
            brace_count = 0
            json_end_index = -1
            in_string = False
            escape = False
            
            for i in range(start_index, len(content)):
                char = content[i]
                
                if escape:
                    escape = False
                    continue
                
                if char == '\\':
                    escape = True
                    continue
                
                if char == '"':
                    in_string = not in_string
                    continue
                
                if not in_string:
                    if char == '{':
                        brace_count += 1
                    elif char == '}':
                        brace_count -= 1
                        if brace_count == 0:
                            json_end_index = i + 1
                            break
            
            if json_end_index != -1:
                json_str = content[start_index:json_end_index]
                try:
                    data = json.loads(json_str)
                    if 'apps' in data and 'dataList' in data['apps']:
                        apps_list = data['apps']['dataList']
                        print(f"Found {len(apps_list)} apps on page.")
                        for app in apps_list:
                            # Extract relevant fields
                            plugin = {
                                "name": app.get('title'),
                                "description": app.get('shortDescription'),
                                "rating": app.get('AverageRating'),
                                "vote_count": app.get('NumberOfRatings'),
                                "publisher": app.get('publisher'),
                                "id": app.get('entityId'),
                                "url": f"https://marketplace.microsoft.com/en-us/marketplace/apps/{app.get('entityId')}?tab=Overview",
                                "categories": [c.get('longTitle') for c in app.get('categoriesDetails', [])] if app.get('categoriesDetails') else [],
                                "industries": [i.get('longTitle') for i in app.get('industriesDetails', [])] if app.get('industriesDetails') else [],
                                "icon_url": app.get('iconURL'),
                                "download_link": app.get('downloadLink'),
                                "price_model": app.get('pricingModel') # 1 might indicate Paid/Free
                            }
                            all_plugins.append(plugin)
                    else:
                        print("No apps data found in JSON.")
                except json.JSONDecodeError as e:
                    print(f"Error decoding JSON on {url}: {e}")
            else:
                print("Could not find end of JSON object.")
        else:
            print("Could not find start of JSON object.")
    else:
        print("Could not find __INITIAL_STATE__ assignment.")

for url in urls:
    fetch_and_parse(url)
    time.sleep(1) # Be polite

# Save to file
output_file = 'plugins.json'
with open(output_file, 'w', encoding='utf-8') as f:
    json.dump(all_plugins, f, indent=2)

print(f"Total plugins extracted: {len(all_plugins)}")
print(f"Saved to {output_file}")
