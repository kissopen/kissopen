# Kissopen Agent Documents

## Where we are going

Documents belong to a Kissopen Agent instance. The Kissopen Agent is the technical node that stores
and serves them; documents do not belong to projects. Kissopen shows the documents
of the selected Kissopen Agent in a Documents tab and lets the user create, find, open, and
edit them.

At first this is entirely local. Each Kissopen Agent keeps its documents in a defined Kissopen
folder on that machine. A document's collaborative state is persisted there,
with an up-to-date normalized Markdown file beside it. The Markdown is the
stable filesystem representation that agents can read and, later, edit without
depending on Kissopen's editor internals.

A session does not own a document. When a document is useful in a session, the
user can attach or share that Kissopen Agent's document with the session so its agents can
work with it. The same document remains independently available on the Kissopen Agent and
can be used by more than one session.

## How we get there

First, bring the existing cloud document experience to ordinary Kissopen Agent-backed
Kissopen: a local collection, editor, durable collaborative state, and normalized
Markdown projection, all owned by one Kissopen Agent instance.

Then make documents attachable to sessions and give agents a stable way to read
them. Agent edits will enter the document as versioned changes rather than
silently replacing its collaborative state.

After the local model is solid, extend the same document and change model across
machines. Kissopen Agents exchange encrypted document-change events through a relay,
allowing documents, versions, and ongoing edits to be shared and synchronized
without making the relay the owner of the data.

## How we know it is done

- Every connected Kissopen Agent exposes its own Documents tab and local document
  collection, independent of projects.
- Documents survive Kissopen and Kissopen Agent restarts in a defined Kissopen folder on the
  machine that owns the Kissopen Agent.
- Every saved collaborative document has a normalized Markdown file beside it,
  and the two stay current as the document changes.
- A document can be attached to a session without being copied into or owned by
  that session, and an agent can read its Markdown representation.
- Agent-authored edits can later be recorded as document versions without
  bypassing the collaborative state.
- The future encrypted relay synchronizes changes between Kissopen Agent nodes while each
  Kissopen Agent remains a real owner of its local document data.