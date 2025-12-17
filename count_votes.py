
import json

def count_plugins_with_votes(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            plugins = json.load(f)
        
        count = 0
        for plugin in plugins:
            if plugin.get('vote_count', 0) > 0:
                count += 1
        return count
    except FileNotFoundError:
        return "Error: plugins.json not found."
    except json.JSONDecodeError:
        return "Error: Could not decode plugins.json. Invalid JSON format."
    except Exception as e:
        return f"An unexpected error occurred: {e}"

if __name__ == "__main__":
    file_path = 'plugins.json'
    num_plugins_with_votes = count_plugins_with_votes(file_path)
    print(f"Number of plugins with user votes: {num_plugins_with_votes}")
