## ADDED Requirements

### Requirement: Concierge outcomes are measured without conversational content
Analytics SHALL distinguish concierge dialog opens, requests started, requests completed, requests failed, and recommended campaign opens from fundraiser Ask events. Events SHALL exclude visitor questions, generated messages, recommendation reasons, and transcript text. Concierge requests SHALL consume the same deployment and visitor AI usage allowance as fundraiser Ask.

#### Scenario: Report a concierge recommendation journey
- **WHEN** a visitor opens the concierge, receives a recommendation, and opens its campaign
- **THEN** reporting can distinguish the concierge open, completed request, and campaign open from fundraiser Ask activity
- **AND** no conversational text is stored in analytics

#### Scenario: Visitor uses both assistants
- **WHEN** a visitor sends requests to fundraiser Ask and the discovery concierge
- **THEN** both request types count against the same configured visitor and deployment allowance
