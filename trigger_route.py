import requests

url = "http://localhost:8000/candidat/account-setup/parse-cv"
# We just need to upload any pdf file to see if the server crashes
files = {'cv': ('test.pdf', b'%PDF-1.4 dummy pdf content for testing', 'application/pdf')}
headers = {}

try:
    print("Uploading dummy PDF...")
    response = requests.post(url, files=files, headers=headers)
    print("Status code:", response.status_code)
    print("Response body:", response.text)
except Exception as e:
    print("Request failed:", e)
