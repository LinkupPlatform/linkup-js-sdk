# 🚀 Linkup JS/TS SDK

[![npm package](https://badge.fury.io/js/linkup-sdk.svg)](https://www.npmjs.com/package/linkup-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A JS/TS SDK for the [Linkup API](https://linkup-api.readme.io/reference/getting-started), allowing
easy integration with Linkup's services. 🐍

## 🌟 Features

- ✅ **Simple and intuitive API client.**
- 🔍 **Supports both standard and deep search queries.**
- 🔒 **Handles authentication and request management.**

## 📦 Installation

Simply install the Linkup JS SDK using `npm` or any other package manager:

```bash
npm i linkup-sdk
```

## 🛠️ Usage

### Setting Up Your Environment

#### 1. **🔑 Obtain an API Key:**

Sign up on [Linkup](https://app.linkup.so) to get your API key.

#### 2. **⚙️ Set-up the API Key:**

Pass the Linkup API key to the Linkup Client when creating it.

```typescript
import { LinkupClient } from 'linkup-sdk';

const client = new LinkupClient({
  apiKey: '<YOUR API KEY>',
});
```

### 📋 Examples

All search queries can be used with two very different modes:

- with `standard` `depth`, the search will be straightforward and fast, suited for relatively simple
  queries (e.g. "What's the weather in Paris today?")
- with `deep` `depth`, the search will use an agentic workflow, which makes it in general slower,
  but it will be able to solve more complex queries (e.g. "What is the company profile of LangChain
  accross the last few years, and how does it compare to its concurrents?")

#### 📝 Standard Search Query

```typescript
import { LinkupClient } from 'linkup-js-sdk';

const client = new LinkupClient({
  apiKey: '<YOUR API KEY>',
});

const askLinkup = async () => {
  return await client.search({
    query: 'Can you tell me which women were awared the Physics Nobel Prize',
    depth: 'standard',
    outputType: 'sourcedAnswer',
  });
};

askLinkup().then(console.log);
```
