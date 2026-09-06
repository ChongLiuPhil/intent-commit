# Contributing

Intent Commit welcomes contributions that improve reflective communication without turning the agent into an autonomous speaker.

## Design test for a contribution

Before adding a feature, ask:

1. Does this increase the speaker's ability to inspect and control what becomes attributable to them?
2. Does it clearly distinguish agent inference from speaker-endorsed content?
3. Can the user correct or reject the agent?
4. Does it preserve explicit human approval before public sending?

## Useful first contributions

- stronger JSON parsing and model adapter tests;
- multilingual Intent Card evaluation cases;
- accessibility improvements;
- portable TypeScript protocol schemas;
- semantic-drift evaluation fixtures;
- room/session architecture proposals;
- privacy and threat-model reviews.

## Development

```bash
npm test
npm start
```

Please include tests when changing protocol or reflector behavior.
