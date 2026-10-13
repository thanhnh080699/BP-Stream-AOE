"""Submit the archival job through the same locks and queue as the CMS."""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from services.admin_jobs import submit

if __name__ == '__main__':
    print(submit('youtube', {}))
