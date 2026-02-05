In the professional world of Computer Science and Information Technology, a **Design Document** is the "blueprint" that exists between the big idea and the final code. It ensures that every technical decision is intentional, every user need is met, and every team member is on the same page.

---

**This Technical Design Specification serves as the blueprint for the Anime Discovery Engine, a web-based application designed to help fans find their next favorite series using real-time data from the Jikan (MyAnimeList) API.**

---

## **I. Executive Summary & Problem Scope**

* **The Problem: With over 15,000 anime titles in existence, users often face "choice paralysis." Existing recommendation engines either require a pre-existing account on a tracking site or provide generic "popular" lists that don't account for a user's specific niche tastes or favorite studios.**  
* **The Solution: A lightweight, "no-login-required" recommendation web app. Users input a few titles they enjoyed and select preferred genres. The system then queries a public API to analyze the metadata (studios, themes, and genres) of those shows to find high-correlation matches.**  
* **Target User: Casual to moderate anime viewers who want quick suggestions without managing a complex database or account.**

---

## **II. Technical Requirements**

### **Functional Requirements**

* **Search & Selection: The system must allow users to search for and select at least 1–5 anime they have already watched.**  
* **Genre Filtering: The system must allow users to toggle specific genre preferences (e.g., "Must include Sci-Fi," "Exclude Horror").**  
* **Recommendation Logic: The system must return a list of 10 recommended titles with a "Similarity Score."**  
* **Metadata Display: Each recommendation must display the title, synopsis, studio, and a direct link to the MyAnimeList page.**

### **Non-Functional Requirements**

* **Performance: API calls must be cached locally to ensure recommendation results load in under 3 seconds.**  
* **Usability: The interface must be responsive (mobile-friendly) and follow Web Content Accessibility Guidelines (WCAG).**  
* **API Ethics: The system must respect Jikan API rate limits (3 requests per second) to avoid IP blacklisting.**

---

## **III. System Architecture & Logic**

**The system follows a Client-Server Architecture. Since we are using a public API, the "Backend" serves primarily as a bridge to process logic and manage rate limiting.**

### **Logic Flowchart**

1. **Start: User enters the landing page.**  
2. **Input Phase: User searches for "watched anime." Frontend fetches search results from Jikan /anime endpoint.**  
3. **Refinement: User selects genres.**  
4. **Processing: \* System identifies common "Tags" (Studio, Genre, Themes) from the user's input.**  
   * **System queries the API for top-rated shows within those overlapping categories.**  
5. **Output: Display results in a grid view.**

---

## **IV. Data Schema & Tech Stack**

### **Tech Stack**

* **Frontend: React.js with Tailwind CSS. *Justification: React allows for a fast, dynamic UI where the recommendation list updates instantly without page reloads.***  
* **Backend: Node.js (Express). *Justification: Necessary to handle API request throttling and to protect any potential API keys or sensitive logic.***  
* **API: Jikan (v4). *Justification: It provides the most comprehensive free data from MyAnimeList without requiring complex OAuth2 authentication.***

### **Data Model**

**The system is largely stateless (we don't store user accounts), but we model the "Anime" object as follows:**

| Field | Type | Description |
| :---- | :---- | :---- |
| **mal\_id** | **Integer** | **Unique identifier from MyAnimeList.** |
| **title** | **String** | **The official name of the anime.** |
| **genres** | **Array** | **List of genre IDs (e.g., \[1, 2, 4\]).** |
| **score** | **Float** | **The community rating out of 10\.** |
| **studio\_id** | **Integer** | **The primary animation studio.** |

---

## **V. Open Questions & Potential Problems**

### **1\. Open Questions**

* **Recommendation Depth: Should the algorithm prioritize "Studio" or "Genre"? (e.g., If I like *Jujutsu Kaisen*, should I see other MAPPA shows or other Shonen shows?)**  
* **Offline Mode: How many results should we cache in localStorage to allow the user to browse their recent history if the API goes down?**  
* **API Rate Limits: If 50 students use the app at once during a demo, will the shared IP of the school cause a 429 "Too Many Requests" error?**

### **2\. Risk Assessment & Mitigation Table**

| Potential Problem (Risk) | Impact | Mitigation Plan |
| :---- | :---- | :---- |
| **API Rate Limiting** | **High** | **Implement a "Queue" in the backend to space out requests by 500ms.** |
| **Niche User Input** | **Medium** | **If a user inputs a very obscure show with no related data, the system will default to "Popular in \[Genre\]" suggestions.** |

---

## **VI. AI Appendix**

### **Prompt Log**

1. ***"Act as a Senior Software Architect. Create a technical design document structure for a web app that uses the Jikan API to recommend anime based on user-provided favorites."***  
2. ***"Write a Risk Assessment table for a high school coding project that relies on a public third-party API."***

### **The Vetting Statement**

**I used AI to help structure the "Risk Assessment" table because I hadn't considered the impact of a school-wide IP address causing API rate limits. I chose to implement a backend queue because it ensures the app remains functional during a live class presentation.**

**Would you like me to help you draft the specific recommendation algorithm logic or create the JSON schema for your data model?**

---

### **4\. Evaluation Rubric**

| Criteria | 1 \- Beginning | 3 \- Proficient | 5 \- Exemplary |
| :---- | :---- | :---- | :---- |
| **Logic & Flow** | Missing diagrams or logic is broken. | Flowchart is logical and covers the main user path. | Covers edge cases (errors, logins, etc.) with professional precision. |
| **Technical Depth** | Vague "Tech Stack" (e.g., "I'll use code"). | Clear list of tools with a basic explanation of use. | In-depth justification of tools and detailed data schema. |
| **AI Ownership** | Content feels "copied/pasted" with no reflection. | AI use is disclosed; student can explain most concepts. | Full transparency; student demonstrates "Senior" level mastery of the AI's suggestions. |
| **Feasibility** | Plan is impossible to build in the given time. | Plan is realistic but lacks a clear timeline. | Includes clear milestones and "Plan B" for technical hurdles. |

---

### **5\. Submission**

* **Format:** Google doc

---

**AI Disclosure:** This assignment was created with the assistance of an AI (Gemini) to ensure professional CS industry standards (like IEEE and Atlassian frameworks) were met while remaining accessible for a high school PBL environment.

