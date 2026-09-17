## Mandatory Standards for Every Change

These standards apply to EVERY feature, bug fix, UI change, database change, refactor, or modification made anywhere in this project, unless the user explicitly tells you otherwise.

### 1. No Emojis or Decorative Icons

- Never add emojis anywhere in the application.
- Never use emoji characters as UI icons.
- Do not add decorative icons to buttons, headings, cards, alerts, badges, navigation, menus, empty states, or messages.
- Keep the interface professional, clean, and text-focused.
- Do not reintroduce emojis that were previously removed.

### 2. Light Mode and Dark Mode

Every UI change must work correctly in BOTH light mode and dark mode.

Before considering a UI change complete:

- Check text contrast in light mode.
- Check text contrast in dark mode.
- Check backgrounds, cards, borders, inputs, dropdowns, tables, modals, buttons, badges, and alerts in both modes.
- Ensure no text becomes invisible, too faint, or visually confusing in either mode.
- Do not solve a light-mode problem by creating a dark-mode problem, or vice versa.
- Preserve the existing theme system rather than introducing unnecessary independent colors.

### 3. Mobile Responsiveness

Every UI change must be responsive.

Check the feature at:

- Desktop width
- Tablet width
- Mobile width

Ensure that:

- No horizontal overflow is introduced.
- Tables remain usable on small screens.
- Forms remain readable and usable.
- Buttons do not become unnecessarily cramped.
- Text does not overlap.
- Modals and dialogs fit within the viewport.
- Navigation remains usable.
- Important content remains accessible without awkward scrolling or broken layouts.
- Touch targets are sufficiently usable on mobile devices.

Do not optimize only for desktop.

### 4. Professional UI/UX

Every new or modified interface must maintain a professional, modern, clean, and consistent design.

Follow these principles:

- Use consistent spacing.
- Use consistent typography.
- Use consistent border radius, borders, shadows, and component sizing.
- Maintain clear visual hierarchy.
- Keep layouts simple and uncluttered.
- Avoid unnecessary decorative elements.
- Use clear and meaningful labels.
- Keep primary actions visually distinguishable from secondary actions.
- Maintain consistency with the existing application design system.
- Do not introduce a completely different visual style for a single feature.

### 5. Accessibility and Readability

Whenever UI is modified:

- Maintain sufficient text/background contrast.
- Ensure form labels are understandable.
- Do not rely only on color to communicate important information.
- Make interactive controls clearly identifiable.
- Preserve keyboard accessibility where applicable.
- Ensure text remains readable at different screen sizes.
- Avoid excessively small text.

### 6. RTL and Urdu Support

This application uses RTL and Urdu content.

Whenever a UI component is created or modified:

- Preserve RTL layout behavior.
- Ensure Urdu text aligns correctly.
- Ensure Arabic/Urdu text does not overlap or break.
- Preserve appropriate Urdu typography.
- Check mixed Urdu/English content carefully.
- Do not introduce unnecessary LTR behavior into RTL interfaces.
- Ensure inputs, labels, dropdowns, tables, and dialogs behave correctly in RTL.

### 7. Existing Functionality Must Be Preserved

When implementing a requested change:

- Modify only what is necessary.
- Do not unnecessarily rewrite unrelated components.
- Do not remove existing functionality unless explicitly requested.
- Do not change unrelated UI or business logic.
- Do not silently alter existing database behavior.
- Check for regressions in related functionality before completing the change.

### 8. Database and Supabase Migration Rule

Whenever a database schema change requires a Supabase migration:

- Always create/update the corresponding migration file in `supabase/migrations/`.
- Verify that the migration file accurately represents the database change.
- Verify migration history alignment between Supabase and Git.
- Include the migration file in the same Git commit as the related application change.
- Never leave a Supabase migration applied remotely without its corresponding Git migration file.
- Never delete or rewrite historical migrations merely to make a Preview check pass.
- Never modify Supabase migration tracking metadata as a shortcut.
- Prefer safe, idempotent SQL where appropriate.
- Before committing, verify that all required migration files are present in Git.

### 9. Git and Commit Discipline

Before committing any change:

- Review `git status`.
- Review `git diff`.
- Confirm that only intended files were modified.
- Do not include unrelated changes in the commit.
- Use a clear and meaningful commit message.
- Push to the intended branch only.
- After pushing, verify the resulting GitHub check status when applicable.

### 10. Build and Regression Verification

Before declaring a change complete:

- Run the project's appropriate validation/build checks.
- Check for syntax or compilation errors.
- Check for obvious runtime errors.
- Verify the changed feature itself.
- Verify closely related functionality that could reasonably be affected.
- Do not claim that something is fixed unless it has actually been verified.

### 11. Do Not Guess

If an issue involves:

- Supabase
- GitHub
- Database schema
- Migration history
- Authentication
- Existing application behavior
- Build/deployment failures

Use the available MCP tools and repository information to investigate the actual current state before making assumptions.

Do not invent database state, Git history, file contents, check results, or deployment status.

### 12. Minimal and Focused Changes

For every user request:

- Focus primarily on the change the user explicitly requested.
- Do not unnecessarily modify previously completed features.
- Do not introduce unrelated refactoring.
- Do not redesign unrelated pages or components.
- Keep the change as small and controlled as reasonably possible.

### 13. Final Verification Checklist

Before reporting a change as complete, verify:

[ ] No emojis or decorative icons were introduced.
[ ] Light mode works correctly.
[ ] Dark mode works correctly.
[ ] Desktop layout works correctly.
[ ] Tablet layout works correctly.
[ ] Mobile layout works correctly.
[ ] RTL/Urdu layout works correctly.
[ ] Existing related functionality still works.
[ ] No unrelated files were unnecessarily modified.
[ ] Database migrations are synchronized with Git when applicable.
[ ] Git status/diff has been reviewed.
[ ] Appropriate build/tests/checks have been completed.
[ ] The actual result has been verified rather than assumed.

### Browser Verification Rule

Whenever you open a browser to inspect, test, verify, or interact with the application, **do not use the local `localhost` version of the project**.

Always use the **latest live version deployed on GitHub Pages** as the browser testing and verification environment. The live GitHub version may contain updates and changes that are not yet reflected in the local `localhost` version, so testing localhost can produce outdated or misleading results.

Before performing any browser-based verification, make sure you are accessing the correct **live GitHub Pages URL**. Use the live deployment as the source of truth for the application's current UI, behavior, and functionality.

Only use `localhost` when the task specifically requires testing an unreleased local change or when live deployment testing is not applicable.

### 14. Madrasa Lifecycle & Access Control Standards

Whenever madrasa status or lifecycle operations are modified:

- **Access Enforcement**: Access control for disabled madrasas is enforced at both route level (`ProtectedRoute.jsx`) and context level (`MadrasaContext.jsx`).
- **Urdu Suspension Notice**: When an institution status is `disabled`, access for regular users (admins and teachers) must remain blocked with an Urdu suspension notice and sign-out button, while `super_admin` retains unrestricted management access.
- **Permanent Deletion**: Permanent deletion of madrasas must always use the atomic `delete_madrasa_completely(p_madrasa_id UUID)` RPC function to cleanly delete child records across all 10 tables (`exam_results`, `exam_miqdar`, `staff_attendance`, `staff`, `student_attendance`, `hifz_half_year_records`, `hifz_records`, `fees`, `students`, `classes`) and delete associated child user accounts from `auth.users` (excluding `super_admin`) so emails can be re-registered without orphaned records.
- **Dark Mode Contrast for Badges**: The Mohtamim Admin badge under dark mode must maintain high contrast with a black background (`#09090b`), dark border (`#27272a`), and clear white text (`#f4f4f5`).
- **No Emojis**: All status pills, action buttons, modals, and suspension screens must remain strictly text-only without emojis or decorative icons.

