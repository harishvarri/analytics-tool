# Double-App QA Verification Report

**Timestamp:** Wed, 03 Jun 2026 12:52:49 GMT
**CivicDesk Host:** https://final-project-v1-nine.vercel.app
**Analytics Host:** https://analytics-tool-web.vercel.app
**Tested User:** harishvarri0@gmail.com

## 1. CivicDesk Client Portal Results

| # | Route | Title | Status | Errors/Details |
|---|---|---|---|---|
| 1 | `/` | frontend | ✅ PASS |  (1 NetErr) |
| 2 | `/reported-issues` | frontend | ✅ PASS |  (2 NetErr) |
| 3 | `/dashboard` | frontend | ✅ PASS |  (1 NetErr) |
| 4 | `/issues` | frontend | ✅ PASS |  (1 NetErr) |
| 5 | `/admin` | frontend | ✅ PASS |  (1 NetErr) |

## 2. Analytics Platform Results

| # | Route | Title | Status | Errors/Details |
|---|---|---|---|---|
| 1 | `/dashboard` | NCPL Operational Intelligence | ✅ PASS |  (4 NetErr) |
| 2 | `/dashboard/access` | NCPL Operational Intelligence | ✅ PASS |  (7 NetErr) |
| 3 | `/dashboard/admin/projects` | NCPL Operational Intelligence | ✅ PASS |  (3 NetErr) |
| 4 | `/dashboard/anomalies` | NCPL Operational Intelligence | ✅ PASS |  (3 NetErr) |
| 5 | `/dashboard/audience` | NCPL Operational Intelligence | ✅ PASS |  (5 NetErr) |
| 6 | `/dashboard/compare` | NCPL Operational Intelligence | ✅ PASS |  (12 NetErr) |
| 7 | `/dashboard/departments` | NCPL Operational Intelligence | ✅ PASS |  (5 NetErr) |
| 8 | `/dashboard/departments/engineering` | NCPL Operational Intelligence | ✅ PASS |  (4 NetErr) |
| 9 | `/dashboard/features` | NCPL Operational Intelligence | ✅ PASS |  (3 NetErr) |
| 10 | `/dashboard/health` | NCPL Operational Intelligence | ✅ PASS |  (5 NetErr) |
| 11 | `/dashboard/incidents` | NCPL Operational Intelligence | ✅ PASS |  (3 NetErr) |
| 12 | `/dashboard/insights` | NCPL Operational Intelligence | ✅ PASS |  (3 NetErr) |
| 13 | `/dashboard/journeys` | NCPL Operational Intelligence | ✅ PASS |  (2 NetErr) |
| 14 | `/dashboard/logins` | NCPL Operational Intelligence | ✅ PASS |  (4 NetErr) |
| 15 | `/dashboard/operations` | NCPL Operational Intelligence | ✅ PASS |  (3 NetErr) |
| 16 | `/dashboard/people` | NCPL Operational Intelligence | ✅ PASS |  (4 NetErr) |
| 17 | `/dashboard/people/d0aa3cab-c5e8-4859-8c7a-345cdd50ca7c` | NCPL Operational Intelligence | ✅ PASS |  (1 NetErr) |
| 18 | `/dashboard/performance` | NCPL Operational Intelligence | ✅ PASS |  (4 NetErr) |
| 19 | `/dashboard/portals` | NCPL Operational Intelligence | ✅ PASS |  (4 NetErr) |
| 20 | `/dashboard/projects/civicdesk` | NCPL Operational Intelligence | ✅ PASS | Loaded successfully |
| 21 | `/dashboard/projects/resume-marketing-portal` | NCPL Operational Intelligence | ✅ PASS |  (1 NetErr) |
| 22 | `/dashboard/projects/project-management-portal` | NCPL Operational Intelligence | ✅ PASS | Loaded successfully |
| 23 | `/dashboard/projects/training-portal` | NCPL Operational Intelligence | ✅ PASS |  (5 NetErr) |
| 24 | `/dashboard/realtime` | NCPL Operational Intelligence | ✅ PASS |  (4 NetErr) |
| 25 | `/dashboard/reliability` | NCPL Operational Intelligence | ✅ PASS |  (4 NetErr) |
| 26 | `/dashboard/retention` | NCPL Operational Intelligence | ✅ PASS |  (11 NetErr) |
| 27 | `/dashboard/sessions` | NCPL Operational Intelligence | ✅ PASS |  (4 NetErr) |
| 28 | `/dashboard/users` | NCPL Operational Intelligence | ✅ PASS |  (4 NetErr) |

## 3. Detailed Failures & Logs

🎉 **All pages on both applications passed visual and functional smoke testing!**

### Network Request Failures (excluding telemetry API errors)

No unexpected network failures on CivicDesk.

#### Analytics Platform:
- **Page:** `https://analytics-tool-web.vercel.app/dashboard` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/compare?_rsc=HxRScRzZn3Qxfq4x` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/retention?_rsc=HxRScRzZn3Qxfq4x` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/reliability?_rsc=HxRScRzZn3Qxfq4x` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/admin/projects?_rsc=HxRScRzZn3Qxfq4x` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/access` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard?_rsc=D4qAVJPPep1g87JR` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/access` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/retention?_rsc=D4qAVJPPep1g87JR` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/access` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/reliability?_rsc=D4qAVJPPep1g87JR` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/access` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/operations?_rsc=D4qAVJPPep1g87JR` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/access` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/people?_rsc=D4qAVJPPep1g87JR` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/access` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/insights?_rsc=D4qAVJPPep1g87JR` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/access` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/admin/projects?_rsc=D4qAVJPPep1g87JR` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/admin/projects` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/people?_rsc=e1rH5jJKXEHYhUfI` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/admin/projects` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/departments?_rsc=e1rH5jJKXEHYhUfI` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/admin/projects` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/reliability?_rsc=e1rH5jJKXEHYhUfI` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/anomalies` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard?_rsc=t1aS6Xy2t6p7WB38` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/anomalies` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/people?_rsc=t1aS6Xy2t6p7WB38` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/anomalies` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/operations?_rsc=t1aS6Xy2t6p7WB38` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/audience` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/compare?_rsc=9MA_f8JsA5DkfJg1` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/audience` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/departments?_rsc=9MA_f8JsA5DkfJg1` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/audience` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/insights?_rsc=9MA_f8JsA5DkfJg1` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/audience` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/incidents?_rsc=9MA_f8JsA5DkfJg1` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/audience` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/admin/projects?_rsc=9MA_f8JsA5DkfJg1` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/compare` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard?_rsc=M1CM3oWnTVhNMHwX` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/compare` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/people?_rsc=M1CM3oWnTVhNMHwX` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/compare` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/health?_rsc=M1CM3oWnTVhNMHwX` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/compare` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/portals?_rsc=M1CM3oWnTVhNMHwX` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/compare` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/departments?_rsc=M1CM3oWnTVhNMHwX` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/compare` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/retention?_rsc=M1CM3oWnTVhNMHwX` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/compare` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/operations?_rsc=M1CM3oWnTVhNMHwX` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/compare` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/reliability?_rsc=M1CM3oWnTVhNMHwX` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/compare` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/anomalies?_rsc=M1CM3oWnTVhNMHwX` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/compare` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/sessions?_rsc=M1CM3oWnTVhNMHwX` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/compare` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/projects/civic-desk?_rsc=M1CM3oWnTVhNMHwX` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/compare` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/projects/sentinel-project?_rsc=M1CM3oWnTVhNMHwX` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/departments` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard?_rsc=bFxqDjAkPO59g_vb` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/departments` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/people?_rsc=bFxqDjAkPO59g_vb` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/departments` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/anomalies?_rsc=bFxqDjAkPO59g_vb` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/departments` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/insights?_rsc=bFxqDjAkPO59g_vb` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/departments` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/admin/projects?_rsc=bFxqDjAkPO59g_vb` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/departments/engineering` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/health?_rsc=rQ_aFGpQkxvyXriP` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/departments/engineering` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/incidents?_rsc=rQ_aFGpQkxvyXriP` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/departments/engineering` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/anomalies?_rsc=rQ_aFGpQkxvyXriP` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/departments/engineering` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/admin/projects?_rsc=rQ_aFGpQkxvyXriP` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/features` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/retention?_rsc=vWzYl5HNxOnPfrWt` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/features` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/people?_rsc=vWzYl5HNxOnPfrWt` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/features` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/insights?_rsc=vWzYl5HNxOnPfrWt` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/health` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/operations?_rsc=qrKZwe8phbT4MwWV` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/health` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/reliability?_rsc=qrKZwe8phbT4MwWV` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/health` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/departments?_rsc=qrKZwe8phbT4MwWV` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/health` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/retention?_rsc=qrKZwe8phbT4MwWV` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/health` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/anomalies?_rsc=qrKZwe8phbT4MwWV` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/incidents` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard?_rsc=YQZ3sW1mdqDlrSB4` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/incidents` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/health?_rsc=YQZ3sW1mdqDlrSB4` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/incidents` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/portals?_rsc=YQZ3sW1mdqDlrSB4` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/insights` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard?_rsc=3i02_WfxksGCG7jl` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/insights` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/operations?_rsc=3i02_WfxksGCG7jl` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/insights` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/people?_rsc=3i02_WfxksGCG7jl` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/journeys` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/compare?_rsc=2wybjulh8y1Z2Nf6` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/journeys` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/portals?_rsc=2wybjulh8y1Z2Nf6` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/logins` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard?_rsc=Orj8L8cNfVmmOXw3` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/logins` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/departments?_rsc=Orj8L8cNfVmmOXw3` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/logins` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/retention?_rsc=Orj8L8cNfVmmOXw3` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/logins` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/anomalies?_rsc=Orj8L8cNfVmmOXw3` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/operations` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/compare?_rsc=ikB7yIfIV2rPeBgi` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/operations` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/realtime?_rsc=ikB7yIfIV2rPeBgi` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/operations` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/reliability?_rsc=ikB7yIfIV2rPeBgi` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/people` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/operations?_rsc=yxaX-RI7DsfP57_f` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/people` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/reliability?_rsc=yxaX-RI7DsfP57_f` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/people` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/admin/projects?_rsc=yxaX-RI7DsfP57_f` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/people` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/people/761657d1-5b7f-4273-a39e-09192eb755e0?_rsc=yxaX-RI7DsfP57_f` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/people/d0aa3cab-c5e8-4859-8c7a-345cdd50ca7c` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/admin/projects?_rsc=uncmeyPDuCQ40IJF` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/performance` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/departments?_rsc=uX_gMocxmCH74F6_` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/performance` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/retention?_rsc=uX_gMocxmCH74F6_` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/performance` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/operations?_rsc=uX_gMocxmCH74F6_` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/performance` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/anomalies?_rsc=uX_gMocxmCH74F6_` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/portals` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/people?_rsc=mldp5VBOQn-xApOc` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/portals` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/compare?_rsc=mldp5VBOQn-xApOc` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/portals` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/anomalies?_rsc=mldp5VBOQn-xApOc` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/portals` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/projects/civic-desk?_rsc=mldp5VBOQn-xApOc` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/projects/resume-marketing-portal` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard?_rsc=yAKED7Om-UV4ICvx` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/projects/training-portal` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/compare?_rsc=8qRGYNrjfsZsKicU` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/projects/training-portal` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/people?_rsc=8qRGYNrjfsZsKicU` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/projects/training-portal` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/departments?_rsc=8qRGYNrjfsZsKicU` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/projects/training-portal` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/incidents?_rsc=8qRGYNrjfsZsKicU` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/projects/training-portal` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/insights?_rsc=8qRGYNrjfsZsKicU` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/realtime` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/people?_rsc=ZK0zm45Uv67G8wL9` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/realtime` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/portals?_rsc=ZK0zm45Uv67G8wL9` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/realtime` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/anomalies?_rsc=ZK0zm45Uv67G8wL9` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/realtime` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/admin/projects?_rsc=ZK0zm45Uv67G8wL9` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/reliability` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/people?_rsc=n15JZVi_EQe3u8nq` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/reliability` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/retention?_rsc=n15JZVi_EQe3u8nq` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/reliability` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/anomalies?_rsc=n15JZVi_EQe3u8nq` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/reliability` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/insights?_rsc=n15JZVi_EQe3u8nq` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/retention` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard?_rsc=yShVawAD82TrRUdY` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/retention` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/compare?_rsc=yShVawAD82TrRUdY` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/retention` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/reliability?_rsc=yShVawAD82TrRUdY` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/retention` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/people/13effa84-d013-4d31-9c4a-4bf71f920d76?_rsc=yShVawAD82TrRUdY` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/retention` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/people/d0aa3cab-c5e8-4859-8c7a-345cdd50ca7c?_rsc=yShVawAD82TrRUdY` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/retention` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/people/72a12beb-48fd-4746-bf39-9bb211e9e950?_rsc=yShVawAD82TrRUdY` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/retention` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/people/07be035c-5da8-44ac-a415-4fa136a7467e?_rsc=yShVawAD82TrRUdY` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/retention` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/people/2fb0d53b-cd1f-4256-ab6c-d42a1431a212?_rsc=yShVawAD82TrRUdY` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/retention` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/people/01a03d9c-4290-4861-89cf-11239dfd4010?_rsc=yShVawAD82TrRUdY` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/retention` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/people/52e0ad8c-e283-416d-a8f4-0bde92fabd52?_rsc=yShVawAD82TrRUdY` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/retention` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/departments/Unassigned?_rsc=yShVawAD82TrRUdY` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/sessions` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard?_rsc=8PNuBDnLKw8tCTGE` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/sessions` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/compare?_rsc=8PNuBDnLKw8tCTGE` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/sessions` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/insights?_rsc=8PNuBDnLKw8tCTGE` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/sessions` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/anomalies?_rsc=8PNuBDnLKw8tCTGE` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/users` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/people?_rsc=oqHEg2DAnWy_WBJc` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/users` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/reliability?_rsc=oqHEg2DAnWy_WBJc` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/users` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/incidents?_rsc=oqHEg2DAnWy_WBJc` (net::ERR_ABORTED)
- **Page:** `https://analytics-tool-web.vercel.app/dashboard/users` -> **Failed Request:** `https://analytics-tool-web.vercel.app/dashboard/insights?_rsc=oqHEg2DAnWy_WBJc` (net::ERR_ABORTED)
