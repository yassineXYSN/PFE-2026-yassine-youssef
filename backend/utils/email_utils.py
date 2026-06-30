import os
import smtplib
from email.message import EmailMessage
from dotenv import load_dotenv

def send_email(to_email: str, subject: str, content: str):
    """
    Sends an email using SMTP settings from the environment.
    """
    load_dotenv()
    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER")
    smtp_password = os.getenv("SMTP_PASSWORD")

    if not smtp_user or not smtp_password:
        print(f"WARNING: SMTP credentials not found. Email to {to_email} not sent.")
        print(f"Content: {content}")
        return False

    try:
        msg = EmailMessage()
        msg.set_content(content)
        msg['Subject'] = f"HumatiQ - {subject}"
        msg['From'] = smtp_user
        msg['To'] = to_email

        print(f"DEBUG EMAIL: Connecting to {smtp_host}:{smtp_port} as {smtp_user}")
        if smtp_port == 465:
            with smtplib.SMTP_SSL(smtp_host, smtp_port) as smtp:
                smtp.login(smtp_user, smtp_password)
                smtp.send_message(msg)
        else:
            with smtplib.SMTP(smtp_host, smtp_port) as smtp:
                smtp.ehlo()
                smtp.starttls()
                smtp.login(smtp_user, smtp_password)
                smtp.send_message(msg)

        print(f"DEBUG EMAIL: Email sent successfully to {to_email}")
        return True
    except Exception as e:
        print(f"ERROR EMAIL: Failed to send email to {to_email}: {e}")
        return False
