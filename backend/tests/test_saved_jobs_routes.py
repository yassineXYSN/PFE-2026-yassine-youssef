import os
import sys


sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app


def test_saved_jobs_route_is_registered_before_dynamic_job_route():
    saved_jobs_index = next(
        index
        for index, route in enumerate(app.router.routes)
        if getattr(route, "path", None) == "/api/jobs/saved"
        and "GET" in getattr(route, "methods", set())
    )
    dynamic_job_index = next(
        index
        for index, route in enumerate(app.router.routes)
        if getattr(route, "path", None) == "/api/jobs/{job_id}"
        and "GET" in getattr(route, "methods", set())
    )

    assert saved_jobs_index < dynamic_job_index
