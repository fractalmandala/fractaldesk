# Intent

**The intent is to have ONE SINGLE APP to manage my webdev work, notes, packages, release status, etc.**
> it is the kind of intent where the app will continuously have a "built-in-use" version, installed; and a "under-dev" version that is continuously being enhanced.

The examples below will illustrate more:

## Example User Stories

### 1. Notes Manager

- For each of my packages, libraries, websites, I have elaborate docs, work logs, spec docs etc. in markdown format. 
- Currently each sits in its own project folder, they are scattered here and there.
- And the lack of a single surface to manage it is severe and stark, causing work friction and lag.

My high-level, non-technical specs of what notes manager would include:
- Folder and file tree in the sidebar. Abillity for me to add folders to it (avoiding the single vault flow, being able to add folders by selection gives greater freedom)
- the UI is better described in the 3 annotated images `notes-manager-*.png` All sidebars are collapsible and width resizable.
- at level 1 i see a markdown notes editor.
- So this kind of markdown editor would be a "built-in-use" version while a "in-dev" version would get initiated, building SASS, CSS, JSON, etc editing also. 

### 2. Projects Trackr

- For each of my packages, libraries, websites, a project tracker that helps me see, manage, track their status.
- again in my layman technicals - start with a core projects.ts file with typed Project interface, and fields like name, location, status, github link, etc.
- i could create checklists, task items for self or for agents, track development

### 3. Theme Builder

This is an example of a project-specific user story. I have a package `fractalthemer` which is a themeing package for the styling system `fractalstyler`. 
- it is also an example of an intent where some of the buildables i may already have, like a color palette generator. 
- a way to test and finalize themes, see them applied in project demos, etc.

So the list is long...
but the Intent is strong...

Aum Namah Shivaya 🙏🏾

## Current status

The rudimentaries are there, I've been experimentally building some minor tools in `fractaldesk`. We have a themes editor, hard-coded to a finite set of themes, and the previewer is not fully well built. themes and schemes are both one tool really, currently different states.

The argv is experimental. The untw is high-ambition and can be high-yield across a variety of my projects.

...