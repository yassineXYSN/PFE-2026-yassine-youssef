from pydantic import BaseModel
from typing import List, Optional


class Education(BaseModel):
    degree: Optional[str] = None
    institution: Optional[str] = None
    fieldOfStudy: Optional[str] = None
    startYear: Optional[str] = None
    endYear: Optional[str] = None
    ongoing: Optional[bool] = False


class Experience(BaseModel):
    jobTitle: Optional[str] = None
    company: Optional[str] = None
    startMonth: Optional[str] = None
    startYear: Optional[str] = None
    endMonth: Optional[str] = None
    endYear: Optional[str] = None
    ongoing: Optional[bool] = False
    description: Optional[str] = None


class Certificate(BaseModel):
    name: Optional[str] = None
    issuer: Optional[str] = None
    year: Optional[str] = None
    url: Optional[str] = None


class Language(BaseModel):
    language: Optional[str] = None
    level: Optional[str] = None


class JobPreferences(BaseModel):
    jobTypes: Optional[List[str]] = []
    workLocation: Optional[List[str]] = []
    salaryExpectation: Optional[str] = ""
    availability: Optional[str] = ""
    preferredIndustries: Optional[List[str]] = []
    willRelocate: Optional[bool] = False


class AccountSetupData(BaseModel):
    firstName: Optional[str] = ""
    lastName: Optional[str] = ""
    birthDate: Optional[str] = ""
    title: Optional[str] = ""
    address: Optional[str] = ""
    linkedinUrl: Optional[str] = ""
    hobbies: Optional[List[str]] = []
    skills: Optional[List[str]] = []
    languages: Optional[List[Language]] = []
    educations: Optional[List[Education]] = []
    experiences: Optional[List[Experience]] = []
    certificates: Optional[List[Certificate]] = []
    jobPreferences: Optional[JobPreferences] = JobPreferences()
