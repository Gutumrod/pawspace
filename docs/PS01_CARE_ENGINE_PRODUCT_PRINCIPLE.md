# PS01 Care Engine Product Principle

Status: LOCKED DESIGN DIRECTION — implementation deferred
Date: 2026-09-17
Scope: PS01 / Pawstia PMS

## Locked Product Principle

> “บอก Pawstia ว่าร้านคุณดูแลสัตว์อย่างไร แล้ว Pawstia จะช่วยให้ทีมทำตามมาตรฐานนั้นทุกวันโดยไม่ตกหล่น”

This principle is the product direction for the future PS01 Care Engine.

Pawstia must not assume that one pet hotel or daycare workflow represents every store. The system should provide a stable operational core while allowing each store to configure how it actually cares for animals.

## Design Direction

The future Care Engine should separate a fixed system core from store-defined care policy.

### Fixed system core

The platform should own the primitives required for reliable operations:

- care tasks with due time, status, assignment, and completion state
- immutable/auditable completion metadata such as who completed the task and when
- medication-specific records and stronger completion/audit requirements
- overdue / missed-task detection
- care evidence attachments such as photo, video, and notes
- separation between care completion and LINE delivery status
- exception and escalation states for abnormal or incomplete care
- manager visibility across all active stays

### Store-configurable policy

Each store should be able to configure its own operating standard, including for example:

- meal count and meal times
- morning / night checks
- medication schedules
- toileting / elimination observation cadence
- activity / walking / play routines
- whether evidence is required for each task type
- whether owner communication is immediate or included in a later summary
- which care events must be delivered through LINE

The system should support reusable presets/templates, but those presets must be editable and must not become mandatory workflow assumptions for all stores.

## Configuration Hierarchy

A likely hierarchy to evaluate during implementation planning is:

Shop Policy → Care Template → Pet Care Plan → Stay-specific Override

This is a design direction, not yet an implementation contract. The purpose is to allow a store-wide default while still supporting individual animal requirements and temporary instructions for a specific stay.

## Care Records and Owner Communication

Daily Report should no longer be treated as the primary care model. It should become one possible output of structured care events.

Important care activities should be stored as care records first. Owner communication should be generated from those records according to store policy.

Conceptually:

Care Task → Care Completion → Care Record / Evidence → Owner Communication

LINE delivery failure must not erase or invalidate the underlying care record. Care execution and message delivery are separate concerns.

## Current Requirement Direction

The following requirements should be evaluated as part of the Care Engine planning work:

- food intake recorded for every meal, with photo or video evidence when required by store policy
- medication recorded every administration, including scheduled time, completion time, responsible staff member, result, and relevant notes/evidence
- daily sleep/rest observation
- daily elimination observation, with abnormal events capable of immediate exception/escalation handling
- scheduled reminders for staff based on room, pet, and care plan
- overdue and missed-care visibility for managers
- configurable LINE communication policy for each event type

Medication and abnormal-care events should be treated as higher-severity operational events than normal routine updates.

## Booking / Payment Dependency

Customer payment and booking deposit are considered important parts of the future PS01 commercial booking lifecycle, but implementation is intentionally deferred.

Reason: WSTERA SB01 Shared Billing Core is being developed as the shared billing/payment foundation. PS01 should not prematurely create a separate payment architecture before the SB01 contract is stable enough to evaluate for reuse.

Current direction:

Booking / Deposit / Payment integration = DEFERRED — pending SB01 contract review

When SB01 reaches an appropriate stable state, PS01 must review the actual SB01 Source of Truth and implementation before deciding how payment, deposit, payment verification, booking hold, expiry, refund, or settlement should integrate.

Do not assume PS01 should duplicate payment rails that SB01 can provide.

## Explicit Non-Decisions

This note does not yet decide:

- final database schema
- task engine implementation details
- reminder transport or scheduler technology
- LINE OA pricing or message-bundling policy
- exact default care templates
- payment provider or payment rail
- deposit percentage or booking hold duration
- package/pricing changes for PS01

Those items must be decided during the dedicated PS01 improvement planning phase after the Care Engine requirements are mapped against the current repository implementation and relevant market evidence.

## Next Planning Phase

When PS01 development resumes, use this document as a locked product-direction input and perform a full implementation plan in one coordinated pass rather than making isolated feature edits.

The planning pass should reconcile this direction against the current PRD, system architecture, database schema, Daily Report implementation, LINE delivery implementation, booking lifecycle, and any stable SB01 billing contract available at that time.
