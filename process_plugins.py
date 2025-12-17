
import json
import os
import re
import requests
import time

def sanitize_filename(name):
    # Replace invalid characters with underscore
    return re.sub(r'[\\/*?:"><|]', '_', name)

def process_plugins():
    with open('plugins.json', 'r', encoding='utf-8') as f:
        plugins = json.load(f)
    
    output_dir = 'excel_plugins'
    os.makedirs(output_dir, exist_ok=True)
    
    count = 0
    download_count = 0
    
    for plugin in plugins:
        try:
            votes = plugin.get('vote_count', 0)
            if votes is None: votes = 0
            
            rating = plugin.get('rating', 0)
            if rating is None: rating = 0.0
            name = plugin.get('name', 'Unknown')
                
            # Sanitize filename components
            safe_name = sanitize_filename(name)
            filename_base = f"{votes}_{rating}_{safe_name}"
            
            # Create MD file
            md_path = os.path.join(output_dir, f"{filename_base}.md")
            
            with open(md_path, 'w', encoding='utf-8') as md_file:
                md_file.write(f"# {name}\n\n")
                md_file.write(f"**Publisher:** {plugin.get('publisher')}\n")
                md_file.write(f"**Rating:** {rating} ({votes} votes)\n")
                md_file.write(f"**Categories:** {', '.join(plugin.get('categories', []))}\n")
                md_file.write(f"**Industries:** {', '.join(plugin.get('industries', []))}\n")
                md_file.write(f"**Marketplace URL:** {plugin.get('url')}\n\n")
                md_file.write("## Description\n\n")
                md_file.write(f"{plugin.get('description', 'No description available.')}\n\n")
                
                download_link = plugin.get('download_link')
                if download_link:
                    md_file.write(f"**Download Link:** {download_link}\n")
                    md_file.write("\n**Status:** Code/Package downloaded.\n")
                else:
                    md_file.write("\n**Status:** No download link available.\n")
            
            # Download code if link exists
            download_link = plugin.get('download_link')
            if download_link:
                # Determine extension
                # Common: .pbiviz, .zip, .xml
                ext = ".zip" # Default
                if "." in download_link.split("/")[-1]:
                     potential_ext = "." + download_link.split("/")[-1].split(".")[-1].split("?")[0]
                     if len(potential_ext) < 10: # Sanity check
                         ext = potential_ext
                
                archive_path = os.path.join(output_dir, f"{filename_base}{ext}")
                
                if not os.path.exists(archive_path):
                    print(f"Downloading {name} to {archive_path}...")
                    try:
                        r = requests.get(download_link, stream=True, timeout=30)
                        r.raise_for_status()
                        with open(archive_path, 'wb') as f:
                            for chunk in r.iter_content(chunk_size=8192):
                                f.write(chunk)
                        download_count += 1
                        # Polite delay only if we actually downloaded
                        time.sleep(0.5) 
                    except Exception as e:
                        print(f"Failed to download {name}: {e}")
                        with open(md_path, 'a') as md_file:
                            md_file.write(f"\n**Download Error:** Failed to download file. {e}\n")
                else:
                    print(f"File {archive_path} already exists. Skipping download.")
            
            count += 1
                
        except Exception as e:
            print(f"Error processing plugin: {e}")
            continue

    print(f"Processed {count} plugins.")
    print(f"Downloaded {download_count} archives.")

if __name__ == "__main__":
    process_plugins()
