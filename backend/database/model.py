from pydantic import BaseModel
from typing import List, Optional, Union, Any, Dict


DocumentMetadata = Dict[str, Any]

class Hobby(BaseModel):
    id: Optional[Union[str, int]] = None
    name: Optional[str] = None

class Skill(BaseModel):
    id: Optional[Union[str, int]] = None
    name: Optional[str] = None
    level: Optional[Union[int, str]] = None

class Language(BaseModel):
    id: Optional[Union[str, int]] = None
    name: Optional[str] = None
    level: Optional[Union[int, str]] = None

class Education(BaseModel):
    id: Optional[Union[str, int]] = None
    degree: Optional[str] = None
    institution: Optional[str] = None
    fieldOfStudy: Optional[str] = None
    startYear: Optional[str] = None
    endYear: Optional[str] = None
    ongoing: Optional[bool] = False
    socialLink: Optional[str] = None
    certificateName: Optional[str] = None
    certificate: Optional[DocumentMetadata] = None


class Experience(BaseModel):
    id: Optional[Union[str, int]] = None
    jobTitle: Optional[str] = None
    company: Optional[str] = None
    type: Optional[str] = None
    position: Optional[str] = None
    startMonth: Optional[str] = None
    startYear: Optional[str] = None
    endMonth: Optional[str] = None
    endYear: Optional[str] = None
    ongoing: Optional[bool] = False
    description: Optional[str] = None
    documentName: Optional[str] = None
    document: Optional[DocumentMetadata] = None


class Certificate(BaseModel):
    id: Optional[Union[str, int]] = None
    name: Optional[str] = None
    issuer: Optional[str] = None
    issuingOrganization: Optional[str] = None
    year: Optional[str] = None
    issueDate: Optional[str] = None
    description: Optional[str] = None
    url: Optional[str] = None
    documentName: Optional[str] = None
    document: Optional[DocumentMetadata] = None


class JobPreferences(BaseModel):
    jobTypes: Optional[Union[List[str], str]] = []
    workLocation: Optional[Union[List[str], str]] = []
    salaryExpectation: Optional[str] = ""
    availability: Optional[str] = ""
    preferredIndustries: Optional[Union[List[str], str]] = []
    willRelocate: Optional[Union[bool, str]] = False


class AccountSetupData(BaseModel):
    cv: Optional[DocumentMetadata] = None
    firstName: Optional[str] = ""
    lastName: Optional[str] = ""
    birthDate: Optional[str] = ""
    title: Optional[str] = ""
    address: Optional[str] = ""
    linkedinUrl: Optional[str] = ""
    profilePicture: Optional[str] = None
    hobbies: Optional[List[Hobby]] = []
    skills: Optional[List[Skill]] = []
    languages: Optional[List[Language]] = []
    educations: Optional[List[Education]] = []
    experiences: Optional[List[Experience]] = []
    certificates: Optional[List[Certificate]] = []
    jobPreferences: Optional[JobPreferences] = JobPreferences()
