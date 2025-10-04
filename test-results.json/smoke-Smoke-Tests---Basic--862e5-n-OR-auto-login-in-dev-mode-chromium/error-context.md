# Page snapshot

```yaml
- generic [ref=e1]:
  - link "Skip to main content" [ref=e2] [cursor=pointer]:
    - /url: "#main-content"
  - dialog "Sign in to SommOS" [ref=e3]:
    - generic [ref=e4]:
      - banner [ref=e5]:
        - generic [ref=e6]: 🍷
        - heading "Sign in to SommOS" [level=1] [ref=e7]
        - paragraph [ref=e8]: Access cellar intelligence, procurement workflows, and guest experiences.
      - tablist "Login options" [ref=e9]:
        - tab "Member Login" [selected] [ref=e10] [cursor=pointer]:
          - generic [ref=e11] [cursor=pointer]: 🔐
          - generic [ref=e12] [cursor=pointer]: Member Login
        - tab "Guest Access" [ref=e13] [cursor=pointer]:
          - generic [ref=e14] [cursor=pointer]: 👤
          - generic [ref=e15] [cursor=pointer]: Guest Access
      - tabpanel "Member Login" [ref=e16]:
        - generic [ref=e17]:
          - generic [ref=e18]:
            - generic [ref=e19]: Email
            - textbox "Email" [active] [ref=e20]
          - generic [ref=e21]:
            - generic [ref=e22]: Password
            - textbox "Password" [ref=e23]
          - button "Sign In" [ref=e24] [cursor=pointer]
        - alert [ref=e25]
      - contentinfo [ref=e26]:
        - generic [ref=e27]: Need access?
        - generic [ref=e28]: Request credentials from the yacht crew.
```