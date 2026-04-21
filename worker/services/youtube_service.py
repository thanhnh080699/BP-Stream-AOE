import os
import pickle
import google.auth.transport.requests
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

# Scopes required for YouTube upload and playlist management
SCOPES = [
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/youtube'
]

class YouTubeService:
    def __init__(self, credentials_path, token_path):
        self.credentials_path = credentials_path
        self.token_path = token_path
        self.service = self._get_authenticated_service()

    def _get_authenticated_service(self):
        creds = None
        # The file token.pickle stores the user's access and refresh tokens
        if os.path.exists(self.token_path):
            with open(self.token_path, 'rb') as token:
                creds = pickle.load(token)
        
        # If there are no (valid) credentials available, let the user log in.
        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                creds.refresh(google.auth.transport.requests.Request())
            else:
                # This part should be handled by a separate script for the first time
                # as it requires browser/interactive input.
                raise Exception(f"Credentials not found or expired. Please run auth helper script. Path: {self.token_path}")

        return build('youtube', 'v3', credentials=creds)

    def upload_video(self, file_path, title, description, category_id="20", privacy_status="public"):
        """
        Uploads a video to YouTube.
        category_id "20" is Gaming.
        """
        if not os.path.exists(file_path):
            print(f"File not found: {file_path}")
            return None

        body = {
            'snippet': {
                'title': title,
                'description': description,
                'categoryId': category_id
            },
            'status': {
                'privacyStatus': privacy_status,
                'selfDeclaredMadeForKids': False
            }
        }

        # Call the API's videos().insert method to create and upload the video.
        insert_request = self.service.videos().insert(
            part=','.join(body.keys()),
            body=body,
            media_body=MediaFileUpload(file_path, chunksize=-1, resumable=True)
        )

        response = None
        while response is None:
            status, response = insert_request.next_chunk()
            if status:
                print(f"Uploaded {int(status.progress() * 100)}%.")

        print(f"Video uploaded successfully! Video ID: {response['id']}")
        return response['id']

    def create_playlist(self, title, description="", privacy_status="public"):
        """Creates a new playlist and returns the playlist ID."""
        body = {
            'snippet': {
                'title': title,
                'description': description
            },
            'status': {
                'privacyStatus': privacy_status
            }
        }
        request = self.service.playlists().insert(
            part='snippet,status',
            body=body
        )
        response = request.execute()
        return response['id']

    def add_video_to_playlist(self, playlist_id, video_id):
        """Adds a video to an existing playlist."""
        body = {
            'snippet': {
                'playlistId': playlist_id,
                'resourceId': {
                    'kind': 'youtube#video',
                    'videoId': video_id
                }
            }
        }
        request = self.service.playlistItems().insert(
            part='snippet',
            body=body
        )
        return request.execute()
