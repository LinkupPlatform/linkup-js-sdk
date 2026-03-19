# 🚀 Linkup JS/TS SDK

[![npm package](https://badge.fury.io/js/linkup-sdk.svg)](https://www.npmjs.com/package/linkup-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![downloads](https://img.shields.io/npm/dm/linkup-sdk.svg)](https://www.npmjs.com/package/linkup-sdk)

A JS/TS SDK for the [Linkup API](https://linkup-api.readme.io/reference/getting-started), allowing
easy integration with Linkup's services.

## 🌟 Features

- ✅ **Simple and intuitive API client.**
- 🔍 **Supports both standard and deep search queries.**
- 🔒 **Handles authentication and request management.**

## 📦 Installation

Simply install the Linkup JS SDK using `npm` or any other package manager:

```bash
npm i linkup-sdk
```

## 📚 Documentation

Find the complete documentation [here](https://docs.linkup.so/pages/sdk/js/js).

## 🛠️ Usage

### Setting Up Your Environment

#### 1. **🔑 Obtain an API Key:**

Sign up on [Linkup](https://app.linkup.so) to get your API key.

#### 2. **⚙️ Set-up the API Key:**

Pass the Linkup API key to the Linkup Client when creating it.

```typescript
import { LinkupClient } from 'linkup-js-sdk';

const client = new LinkupClient({
  apiKey: '<YOUR API KEY>',
});
```

### 📋 Search Endpoint

All search queries can be used with two very different modes:

- with `standard` `depth`, the search will be straightforward and fast, suited for relatively simple
  queries (e.g. "What's the weather in Paris today?")
- with `deep` `depth`, the search will use an agentic workflow, which makes it in general slower,
  but it will be able to solve more complex queries (e.g. "What is the company profile of LangChain
  accross the last few years, and how does it compare to its concurrents?")

#### 📝 Example standard search query

```typescript
import { LinkupClient } from 'linkup-js-sdk';

const client = new LinkupClient({
  apiKey: '<YOUR API KEY>',
});

const askLinkup = () => client.search({
  query: 'Can you tell me which women were awared the Physics Nobel Prize',
  depth: 'standard',
  outputType: 'sourcedAnswer',
});

askLinkup()
  .then(console.log);
  .catch(console.error);
```

### ⬇️ Fetch Endpoint

You can use the fetch endpoint to retrieve the content of a given URL in clean `markdown` format.

Use `renderJs` to execute the JavaScript code of the page before returning the content.

Use `includeRawHtml` to get the raw HTML of the page.

Use `extractImages` to get an extracted list of images from the page.

#### 📝 Example

```typescript
import { LinkupClient } from 'linkup-js-sdk';

const client = new LinkupClient({
  apiKey: '<YOUR API KEY>',
});

const fetchLinkup = async () => client.fetch({
  url: 'https://docs.linkup.so',
  renderJs: true,
});

fetchLinkup()
  .then(console.log)
  .catch(console.error);
```

### 💳 X402 Payment Protocol

The SDK supports the [X402 payment protocol](https://www.x402.org/), allowing you to pay for API
calls with on-chain transactions instead of an API key.

#### Prerequisites

Install the required peer dependencies:

```bash
npm i viem @x402/core @x402/evm
```

#### 📝 Example

Create a viem `LocalAccount` compatible with Base (Ethereum):

```typescript
import { privateKeyToAccount } from 'viem/accounts';

const account = privateKeyToAccount('<YOUR WALLET PRIVATE KEY>');
```

```typescript
import { mnemonicToAccount } from 'viem/accounts';

const account = mnemonicToAccount('<YOUR MNEMONIC PHRASE>');
```

Then pass it to `createX402Signer` and use the Linkup client:

```typescript
import { LinkupClient } from 'linkup-sdk';
import { createX402Signer } from 'linkup-sdk/x402';

const signer = createX402Signer(account);
const client = new LinkupClient({ signer });

const response = await client.search({
  query: 'What is the X402 payment protocol?',
  depth: 'standard',
  outputType: 'sourcedAnswer',
});
```
