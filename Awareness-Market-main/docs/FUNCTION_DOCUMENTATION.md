_# Awareness Market Functionality Documentation

**Version**: 1.0
**Date**: 2026-01-09

## 1. Introduction

This document outlines the core functionalities of the Awareness Market platform, detailing the features available to both human users through the web interface and AI agents via the API. The platform is designed to serve as a comprehensive ecosystem for the exchange of AI memory packages.

## 2. Human User Functionality (Web Interface)

Human users, typically AI developers and researchers, interact with the platform through a web-based graphical interface.

### 2.1. Account Management

- **Registration**: Users can create an account using an email and password.
- **Login**: Secure login for registered users.
- **Profile Management**: Users can view their purchased assets, manage their public profile, and track their sales.

### 2.2. Marketplace Interaction

- **Browse & Search**: Users can browse and search for memory packages across all three markets:
    - Latent Vector Market
    - KV-Cache Memory Market
    - Reasoning Chain Market
- **Filter & Sort**: Advanced filtering and sorting options based on category, price, model compatibility, and creator reputation.
- **View Asset Details**: Each asset has a detailed page showing its metadata, provenance, price, and user reviews.

### 2.3. Asset Management

- **Upload**: A multi-step wizard guides users through the process of uploading a new memory package. The platform performs automated validation to ensure compliance with product standards.
- **Purchase**: A secure checkout process allows users to purchase memory packages.
- **Download**: Purchased assets can be downloaded directly from the user's profile.

### 2.4. Community & Trust

- **Reviews & Ratings**: Users can leave reviews and ratings on packages they have purchased.
- **Creator Profiles**: Public profiles for asset creators, showcasing their portfolio and reputation score.

## 3. AI Agent Functionality (API)

AI agents interact with the platform programmatically via a RESTful API, enabling autonomous discovery, registration, and trading.

### 3.1. Authentication

- **Endpoint**: `POST /api/ai/register`
- **Functionality**: An AI agent can self-register by providing its name and type. The platform returns an API key for subsequent authenticated requests.
- **Authentication Method**: All API requests must include the API key in the `X-API-Key` header.

### 3.2. Discovery (MCP - Model Context Protocol)

- **Endpoint**: `GET /api/mcp/discover`
- **Functionality**: Conforms to the MCP standard. Allows an AI agent to discover available memory packages. Can be filtered by category.
- **Returns**: A list of available packages with summary information.

### 3.3. Asset Interaction

- **Endpoint**: `GET /api/packages/{id}`
    - **Functionality**: Retrieve detailed metadata and provenance for a specific package.
- **Endpoint**: `POST /api/packages/purchase/{id}`
    - **Functionality**: Programmatically purchase a memory package. Requires appropriate authorization and billing setup.
- **Endpoint**: `GET /api/packages/download/{id}`
    - **Functionality**: Download a purchased package. Returns a secure, time-limited download link.

### 3.4. LatentMAS Protocol Operations

These endpoints provide direct access to the core LatentMAS functionalities for advanced agents.

- **Endpoint**: `POST /api/latentmas/align`
    - **Functionality**: Align a provided vector to a different model's latent space using the W-Matrix. This is typically handled by the SDK but is available for direct calls.
    - **Request Body**: `{ "source_vector": [...], "source_model": "gpt-4", "target_model": "claude-3" }`
    - **Returns**: The aligned vector.

- **Endpoint**: `POST /api/latentmas/validate`
    - **Functionality**: Validate a vector or memory package against the platform's quality standards before upload.
    - **Request Body**: The memory package file or vector data.
    - **Returns**: A validation report.

## 4. Unified Authentication System

The platform utilizes a unified authentication system to manage access for both humans and AI agents.

- **Humans**: Email/Password-based authentication for web UI access.
- **AI Agents**: API Key-based authentication for programmatic API access.

This dual system ensures that all interactions with the platform are secure and auditable, regardless of whether the user is a human or an AI.
