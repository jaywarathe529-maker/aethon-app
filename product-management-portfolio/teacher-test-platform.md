# Teacher Test and Evaluation Platform

## Status

Product discovery and MVP definition. No user interviews, launch, or measured results are claimed yet.

## Product opportunity

Teachers often use disconnected tools to create examinations, collect typed or handwritten answers, evaluate subjective responses, and analyse class performance. The proposed product combines these activities into one assessment workflow.

## Target users

- Teachers conducting school, college, coaching, or professional assessments
- Students taking objective and subjective examinations
- Institute administrators managing teachers, courses, and results

## Jobs to be done

- When preparing an assessment, a teacher needs to create and reuse different question formats quickly.
- When answering a subjective question, a student needs the choice to type or upload a handwritten response.
- When evaluation is complete, a teacher needs question- and class-level insights to identify learning gaps.

## MVP requirements

1. Teacher and student roles
2. Teacher-created tests without preloaded subject restrictions
3. Single-choice, multiple-select, numerical, and subjective questions
4. Typed and file-uploaded subjective answers
5. Automatic evaluation for objective questions
6. Manual evaluation workflow for subjective questions
7. Test scheduling, duration, and submission controls
8. Student and class performance dashboards
9. Reusable teacher-owned question bank

## Prioritisation

| Feature | Reach | Impact | Confidence | Effort | Decision |
|---|---:|---:|---:|---:|---|
| Test builder | High | High | High | Medium | MVP |
| Four question formats | High | High | High | Medium | MVP |
| Manual subjective evaluation | High | High | High | Medium | MVP |
| Performance dashboard | Medium | High | Medium | Medium | MVP |
| Automated AI grading | Medium | High | Low | High | Later |
| Advanced proctoring | Low | Medium | Low | High | Later |

## Primary workflow

Teacher creates test → selects question formats → schedules test → student submits responses → system grades objective answers → teacher grades subjective answers → results and analytics are published.

## Success metrics

- **North-star metric:** completed evaluated tests per active teacher per month
- Median time required to create a test
- Test completion rate
- Percentage of subjective submissions successfully reviewed
- Weekly active teachers
- Question-bank reuse rate
- Teacher satisfaction after the first completed test
- Guardrails: upload failure rate, grading corrections, and student support incidents

## Validation plan

1. Interview 5–8 teachers and 10–15 students.
2. Test a clickable prototype with at least five users.
3. Measure task completion and usability errors.
4. Build the smallest functional test-creation and submission flow.
5. Pilot one real assessment with consent.
6. Compare creation and evaluation time against the teacher's current process.

## Business model hypothesis

- Free tier for individual teachers with limited active tests
- Paid educator tier with expanded question banks and analytics
- Institution tier with administrator controls and multiple teacher accounts

## Key risks

- Trust in grading accuracy
- Privacy of student information and uploaded answer sheets
- Teacher resistance to changing established workflows
- Unreliable connectivity during timed tests
- Scope expansion into full learning-management functionality

## Tools proposed

Figma, Jira or Trello, SQL, Excel/Power BI, web analytics, and a full-stack web framework.
