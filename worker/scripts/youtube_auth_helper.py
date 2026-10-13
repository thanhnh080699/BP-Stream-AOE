import os
import tempfile
from google_auth_oauthlib.flow import InstalledAppFlow

# Scopes required for YouTube upload and playlist management
SCOPES = [
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/youtube'
]

def run_flow(credentials_path, token_path):
    """
    Runs the OAuth2 flow to get the token.
    This script needs to be run in an environment where you can access a browser
    or use the console-based flow.
    """
    if not os.path.exists(credentials_path):
        print(f"Error: Credentials file not found at {credentials_path}")
        print("Please download client_secrets.json from Google Cloud Console and place it there.")
        return

    flow = InstalledAppFlow.from_client_secrets_file(credentials_path, SCOPES)
    
    # We use run_local_server which is the easiest if the user is on the same machine.
    # If they are on a remote server, they might need run_console() but that's deprecated.
    # For many AI assistants, run_local_server works if there's tunnel or if it's local.
    # Otherwise, we provide the URL and let them paste the code.
    creds = flow.run_local_server(port=0)

    # Save the credentials for the next run
    descriptor, temporary = tempfile.mkstemp(dir=os.path.dirname(token_path))
    with os.fdopen(descriptor, 'w') as token:
        token.write(creds.to_json())
    os.chmod(temporary, 0o600)
    os.replace(temporary, token_path)
    
    print(f"Authentication successful! Token saved to {token_path}")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description='YouTube Auth Helper')
    parser.add_argument('--secrets', default='youtube_secrets.json', help='Path to client_secrets.json')
    parser.add_argument('--token', default='youtube_token.json', help='Path to save youtube_token.pickle')
    
    args = parser.parse_args()
    
    # Use paths relative to current working directory (standard CLI behavior)
    absolute_secrets = os.path.abspath(args.secrets)
    absolute_token = os.path.abspath(args.token)
    
    run_flow(absolute_secrets, absolute_token)
