import smtplib
from email.message import EmailMessage
import os
from dotenv import load_dotenv

async def send_email(to_email: str, subject: str, content: str):
    """
    Centralised utility to send emails via SMTP.
    Defaults to Supabase SMTP (smtp.supabase.co:587) with STARTTLS.
    Requires SMTP_USER and SMTP_PASSWORD in .env.
    Runs synchronously in a separate thread to avoid blocking the event loop.
    """
    import anyio
    
    def _send():
        load_dotenv()
        smtp_user = os.getenv("SMTP_USER")
        smtp_password = os.getenv("SMTP_PASSWORD")
        smtp_host = os.getenv("SMTP_HOST", "smtp.supabase.co")
        smtp_port = int(os.getenv("SMTP_PORT", "587"))
        
        if not smtp_user or not smtp_password:
            print(f"WARNING: SMTP credentials missing in .env. Email to {to_email} not sent.")
            print(f"--- EMAIL CONTENT PREVIEW ---")
            print(f"To: {to_email}")
            print(f"Subject: {subject}")
            print(f"Content:\n{content}")
            print(f"-----------------------------")
            return False

        try:
            msg = EmailMessage()
            msg.set_content(content)
            msg['Subject'] = subject
            msg['From'] = smtp_user
            msg['To'] = to_email
            
            with smtplib.SMTP(smtp_host, smtp_port) as smtp:
                smtp.starttls()
                smtp.login(str(smtp_user), str(smtp_password))
                smtp.send_message(msg)
                print(f"Email sent successfully to {to_email} via {smtp_host}")
            return True
        except Exception as e:
            print(f"SMTP Error sending email to {to_email} via {smtp_host}: {e}")
            return False

    return await anyio.to_thread.run_sync(_send)
