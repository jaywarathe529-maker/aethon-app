# Scientific Simulation Workflow Manager

## Status

Product discovery and MVP definition based on a researcher workflow. No adoption or performance results are claimed yet.

## Product opportunity

Researchers using tools such as LAMMPS, GROMACS, and Aspen frequently manage parameters, input files, run histories, failures, notes, and results across folders and spreadsheets. This makes reproducibility and comparison difficult.

## Target users

- Postgraduate researchers performing computational simulations
- Faculty members supervising multiple research projects
- Laboratory teams sharing computational resources
- Technical teams running repeated parameter studies

## Core problem

A researcher needs one traceable record connecting a simulation's inputs, parameters, execution status, outputs, observations, and conclusions.

## MVP requirements

1. Project and simulation-run creation
2. Parameter templates for different simulation tools
3. Input and output file attachment
4. Run status: queued, running, failed, or completed
5. Version history and researcher notes
6. Side-by-side parameter and result comparison
7. Searchable run history
8. Exportable experiment summary
9. Basic team roles and permissions

## Example user story

As an MD researcher, I want to compare temperature, electric field, composition, and resulting transport properties across runs so that I can identify meaningful trends without manually searching multiple directories.

### Acceptance criteria

- The user can select at least two completed runs.
- Changed parameters are highlighted.
- Selected output metrics appear in one comparison view.
- Missing values are clearly identified.
- The comparison can be exported.

## Prioritisation

| Feature | User value | Technical effort | Release |
|---|---|---|---|
| Run registry | High | Low | MVP |
| Parameter templates | High | Medium | MVP |
| Run comparison | High | Medium | MVP |
| Notes and file links | High | Low | MVP |
| Live cluster execution | High | High | Later |
| Automatic result parsing | High | High | Later |
| Collaboration and approvals | Medium | Medium | Next |

## Success metrics

- **North-star metric:** simulation runs documented and compared per active researcher
- Percentage of completed runs with reproducible metadata
- Time required to locate a previous run
- Run-comparison usage rate
- Weekly active researchers
- Failed-run diagnosis time
- Guardrails: incorrect metadata, inaccessible files, and abandoned projects

## Discovery and validation plan

1. Interview researchers from molecular simulation and process-simulation groups.
2. Map their workflow from input preparation to analysis.
3. Identify the most common sources of lost context and repeated work.
4. Prototype the run registry and comparison workflow.
5. Conduct task-based usability testing.
6. Pilot the MVP on a real, non-confidential simulation project.
7. Measure documentation completeness and retrieval time.

## Product differentiation

The initial product would focus on scientific simulations rather than generic task management. Domain-specific parameter templates, reproducibility checks, and result comparison would form the core value proposition.

## Key risks

- Supporting too many simulation formats
- Large output files and storage costs
- Confidential or unpublished research data
- Integration complexity with computing clusters
- Incorrect automatic parsing of scientific outputs

## Tools proposed

Figma, GitHub, Jira, SQL, Python-based parsing, Plotly/Power BI, and a web dashboard.
