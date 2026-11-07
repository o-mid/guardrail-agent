# Interview notes

Notes on the choices in this repo, for a walkthrough of `/break-it` and `/scorecard`. Not a claim about a production payment system.

## What the firewall is

The planner returns JSON. Go policy checks that JSON. The executors turn an allowlisted step into a local transaction. The model never hands the API calldata.

`/break-it` has no account. The visitor types text. The same planner and the same policy run. If policy allows the plan, the API broadcasts it on local Anvil. If policy blocks it, the page shows the fields it would have signed and labels that block as a simulation. The logged-in console still waits for a person to approve each step.

The approval screen reads the step payload. The model’s summary is labeled as a summary. It is not the thing the approve button is agreeing to.

## Why a second allowlisted address

`recipient_not_allowed` already fires when the recipient is off the list. A swap to `0x2222…2222` is on the list, so that code stays quiet and `recipient_swap` is the one that says the plan left the invoice’s vendor. The lookalike address is a different check: same length, same first and last four hex characters, not equal to an allowlisted address.

## Why the window is passed in, not stored in policy

Policy stays a pure check of one plan plus an optional context. The rolling spend and the paid invoice ids live in the API, because they are arena state. The logged-in console does not send that context, so those codes do not appear there. The cost is that a restart forgets the window. A ledger would be the durable version. This demo does not have one.

## Why the arena can broadcast

The console path is the product with a person in the loop. The public page is the demo of “if policy allows it, it runs.” Both call the same policy. The page is only useful if a block and an allow look different, and an allow that never hits a chain is just another simulation. The broadcast is local Anvil, chain id 31337, and boot refuses anything else.

## What the scorecard is for

CI needs a failure when a rule gets weaker. The attack files are stored plans, the same shape the mock returns for the samples on `/break-it`. The runner posts them at policy. A unit test shows the comparator rejects an allow with no codes. That is the regression.

The mock pass is a second score so “the model followed the text” and “policy stopped the payment” are not the same sentence. On the duplicate invoice, the mock pays the right vendor and policy still blocks it.

A live model has not been run. The nightly workflow is wired and skips cleanly when the key, the model name, or the token prices are unset. Skipping is not a result.

## What to change before treating this as a payment system

The list in [production-gaps.md](production-gaps.md) is the list. The spend window should survive a restart. A live model should be on the scorecard only after a real run, with the model name, the commit, the token counts, and the cost. The demo vault is one process with a bearer token. A compromised API can still ask it to sign. None of that is fixed by a greener fixture run.
