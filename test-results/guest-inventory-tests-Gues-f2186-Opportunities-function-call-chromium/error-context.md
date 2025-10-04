# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - link "Skip to main content" [ref=e2] [cursor=pointer]:
    - /url: "#main-content"
  - dialog "Guest Access" [ref=e3]:
    - generic [ref=e4]:
      - banner [ref=e5]:
        - generic [ref=e6]: 🍷
        - heading "Guest Access" [level=1] [ref=e7]
        - paragraph [ref=e8]: Browse the wine collection with read-only access using your event code.
      - tablist "Login options" [ref=e9]:
        - tab "Member Login" [ref=e10] [cursor=pointer]:
          - generic [ref=e11] [cursor=pointer]: 🔐
          - generic [ref=e12] [cursor=pointer]: Member Login
        - tab "Guest Access" [selected] [ref=e13] [cursor=pointer]:
          - generic [ref=e14] [cursor=pointer]: 👤
          - generic [ref=e15] [cursor=pointer]: Guest Access
      - tabpanel "Guest Access" [ref=e16]:
        - generic [ref=e17]:
          - heading "Guest Access" [level=3] [ref=e18]
          - paragraph [ref=e19]: Have an event code? Enter it below for read-only access to the wine collection.
          - generic [ref=e20]:
            - generic [ref=e21]: Event Code
            - textbox "Event Code" [ref=e22]: YACHT2025
            - generic [ref=e23]: Event codes are provided by the yacht crew
          - generic [ref=e24]:
            - checkbox "This code requires a PIN" [ref=e25] [cursor=pointer]
            - generic [ref=e26] [cursor=pointer]: This code requires a PIN
          - button "👤 Join as Guest" [ref=e27] [cursor=pointer]
          - alert [ref=e28]: Too many API requests from this IP, please try again later.
      - contentinfo [ref=e29]:
        - generic [ref=e30]: Need access?
        - generic [ref=e31]: Request credentials from the yacht crew.
```