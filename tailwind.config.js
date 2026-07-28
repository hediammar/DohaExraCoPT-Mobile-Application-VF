/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx,html}"],
  darkMode: "class",
  theme: {
    extend: {
      borderColor: {
        DEFAULT: "#7A2531",
      },
      colors: {
        background: "#8B2633",
        foreground: "#ffffff",
        card: {
          DEFAULT: "#5A1A23",
          foreground: "#ffffff",
        },
        popover: {
          DEFAULT: "#3D111A",
          foreground: "#ffffff",
        },
        primary: {
          DEFAULT: "#C13B4A",
          foreground: "#ffffff",
        },
        secondary: {
          DEFAULT: "#7A2531",
          foreground: "#ffffff",
        },
        muted: {
          DEFAULT: "#5A1A23",
          foreground: "#D1B3B8",
        },
        accent: {
          DEFAULT: "#9B3340",
          foreground: "#ffffff",
        },
        destructive: {
          DEFAULT: "#DC2626",
          foreground: "#ffffff",
        },
        border: "#7A2531",
        input: {
          DEFAULT: "#3D111A",
          background: "#3D111A",
        },
        switch: {
          background: "#7A2531",
        },
        ring: "#C13B4A",

        // Qatar theme status colors
        status: {
          complete: {
            DEFAULT: "#2D5A3D",
            foreground: "#A7E8B5",
          },
          active: {
            DEFAULT: "#C13B4A",
            foreground: "#ffffff",
          },
          onhold: {
            DEFAULT: "#8B5A2D",
            foreground: "#F2D99F",
          },
          inactive: {
            DEFAULT: "#5A2D31",
            foreground: "#D1B3B8",
          },
          rejected: {
            DEFAULT: "#7A1F1F",
            foreground: "#F2A6A6",
          },
          delivered: {
            DEFAULT: "#2D4A5A",
            foreground: "#A6CCE8",
          },
          manufactured: {
            DEFAULT: "#5A3D2D",
            foreground: "#E8C7A6",
          },
          inspected: {
            DEFAULT: "#4A2D5A",
            foreground: "#C7A6E8",
          },
          installed: {
            DEFAULT: "#1F4A3D",
            foreground: "#80E6CC",
          },
        },

        // Chart colors
        chart: {
          1: "#C13B4A",
          2: "#2D5A3D",
          3: "#2D4A5A",
          4: "#8B5A2D",
          5: "#5A3D2D",
        },

        // Sidebar specific
        sidebar: {
          DEFAULT: "#3D111A",
          foreground: "#ffffff",
          primary: {
            DEFAULT: "#C13B4A",
            foreground: "#ffffff",
          },
          accent: {
            DEFAULT: "#5A1A23",
            foreground: "#ffffff",
          },
          border: "#7A2531",
          ring: "#C13B4A",
        },

        // Application branding
        app: {
          primary: "#C13B4A",
          secondary: "#8B2633",
          accent: "#9B3340",
        },
      },

      fontSize: {
        base: ["var(--font-size, 14px)", { lineHeight: "1.5" }],
        mobile: ["var(--font-size-mobile, 16px)", { lineHeight: "1.5" }],
      },

      fontWeight: {
        normal: "var(--font-weight-normal, 400)",
        medium: "var(--font-weight-medium, 500)",
      },

      borderRadius: {
        sm: "calc(var(--radius, 0.75rem) - 4px)",
        md: "calc(var(--radius, 0.75rem) - 2px)",
        lg: "var(--radius, 0.75rem)",
        xl: "calc(var(--radius, 0.75rem) + 4px)",
      },

      spacing: {
        header: "var(--header-height, 64px)",
        "header-mobile": "var(--header-height-mobile, 56px)",
      },

      backgroundImage: {
        "qatar-body": "linear-gradient(135deg, #8B2633 0%, #7A2531 100%)",
        "qatar-card": "linear-gradient(135deg, #5A1A23 0%, #4D1620 100%)",
        "qatar-sidebar": "linear-gradient(180deg, #3D111A 0%, #2D0C14 100%)",
      },

      boxShadow: {
        "qatar-card":
          "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)",
      },

      animation: {
        "fade-in": "fadeIn 0.3s ease-out",
        "popover-in": "popover-in 0.15s cubic-bezier(0.16, 1, 0.3, 1)",
      },

      keyframes: {
        fadeIn: {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "popover-in": {
          "0%": { opacity: "0", transform: "scale(0.95) translateY(-2px)" },
          "100%": { opacity: "1", transform: "scale(1) translateY(0)" },
        },
      },
    },
  },
  plugins: [
    function ({ addBase, addUtilities, addComponents }) {
      addBase({
        "*": {
          borderColor: "var(--border, #7A2531)",
          outlineColor: "hsla(var(--ring, #C13B4A) / 0.5)",
        },
        body: {
          background: "linear-gradient(135deg, #8B2633 0%, #7A2531 100%)",
          color: "var(--foreground, #ffffff)",
          overflowX: "hidden",
          WebkitFontSmoothing: "antialiased",
          MozOsxFontSmoothing: "grayscale",
          WebkitTextSizeAdjust: "100%",
        },
        ':where(:not(:has([class*=" text-"]), :not(:has([class^="text-"]))))': {
          h1: {
            fontSize: "var(--text-2xl, 1.5rem)",
            fontWeight: "var(--font-weight-medium, 500)",
            lineHeight: "1.4",
            color: "var(--foreground, #ffffff)",
          },
          h2: {
            fontSize: "var(--text-xl, 1.25rem)",
            fontWeight: "var(--font-weight-medium, 500)",
            lineHeight: "1.4",
            color: "var(--foreground, #ffffff)",
          },
          h3: {
            fontSize: "var(--text-lg, 1.125rem)",
            fontWeight: "var(--font-weight-medium, 500)",
            lineHeight: "1.4",
            color: "var(--foreground, #ffffff)",
          },
          h4: {
            fontSize: "var(--text-base, 1rem)",
            fontWeight: "var(--font-weight-medium, 500)",
            lineHeight: "1.4",
            color: "var(--foreground, #ffffff)",
          },
          p: {
            fontSize: "var(--text-base, 1rem)",
            fontWeight: "var(--font-weight-normal, 400)",
            lineHeight: "1.5",
            color: "var(--foreground, #ffffff)",
          },
          label: {
            fontSize: "var(--text-base, 1rem)",
            fontWeight: "var(--font-weight-medium, 500)",
            lineHeight: "1.4",
            color: "var(--foreground, #ffffff)",
          },
          button: {
            fontSize: "var(--text-base, 1rem)",
            fontWeight: "var(--font-weight-medium, 500)",
            lineHeight: "1.4",
          },
          input: {
            fontSize: "var(--text-base, 1rem)",
            fontWeight: "var(--font-weight-normal, 400)",
            lineHeight: "1.5",
            color: "var(--foreground, #ffffff)",
          },
        },
        html: {
          fontSize: "var(--font-size, 14px)",
        },
        "@media (max-width: 767px)": {
          html: {
            fontSize: "var(--font-size-mobile, 16px)",
          },
          'button, [role="button"], input, select, textarea': {
            minHeight: "44px",
          },
        },
        "@media (prefers-reduced-motion: reduce)": {
          "*": {
            animationDuration: "0.01ms !important",
            animationIterationCount: "1 !important",
            transitionDuration: "0.01ms !important",
          },
        },
        "@media (-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi)":
          {
            body: {
              WebkitFontSmoothing: "antialiased",
              MozOsxFontSmoothing: "grayscale",
            },
          },
        "@media print": {
          ".no-print": {
            display: "none !important",
          },
          "*": {
            background: "white !important",
            color: "black !important",
          },
          ".sticky-header": {
            display: "none !important",
          },
        },
        "*:focus-visible": {
          outline: "2px solid hsl(var(--ring))",
          outlineOffset: "2px",
        },
        "*": {
          transitionProperty: "color, background-color, border-color",
          transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
          transitionDuration: "150ms",
        },
        "::-webkit-scrollbar": {
          width: "8px",
        },
        "::-webkit-scrollbar-track": {
          background: "var(--muted, #5A1A23)",
        },
        "::-webkit-scrollbar-thumb": {
          background: "var(--primary, #C13B4A)",
          borderRadius: "4px",
        },
        "::-webkit-scrollbar-thumb:hover": {
          background: "var(--accent, #9B3340)",
        },
      });

      addUtilities({
        // Status badges
        ".status-complete": {
          backgroundColor: "var(--status-complete, #2D5A3D)",
          color: "var(--status-complete-foreground, #A7E8B5)",
          padding: "0.25rem 0.5rem",
          borderRadius: "0.375rem",
          fontSize: "0.75rem",
          fontWeight: "500",
          border: "1px solid rgba(34, 197, 94, 0.2)",
        },
        ".status-active": {
          backgroundColor: "var(--status-active, #C13B4A)",
          color: "var(--status-active-foreground, #ffffff)",
          padding: "0.25rem 0.5rem",
          borderRadius: "0.375rem",
          fontSize: "0.75rem",
          fontWeight: "500",
        },
        ".status-onhold": {
          backgroundColor: "var(--status-onhold, #8B5A2D)",
          color: "var(--status-onhold-foreground, #F2D99F)",
          padding: "0.25rem 0.5rem",
          borderRadius: "0.375rem",
          fontSize: "0.75rem",
          fontWeight: "500",
          border: "1px solid rgba(245, 158, 11, 0.2)",
        },
        ".status-inactive": {
          backgroundColor: "var(--status-inactive, #5A2D31)",
          color: "var(--status-inactive-foreground, #D1B3B8)",
          padding: "0.25rem 0.5rem",
          borderRadius: "0.375rem",
          fontSize: "0.75rem",
          fontWeight: "500",
          border: "1px solid rgba(107, 114, 128, 0.2)",
        },
        ".status-installed": {
          backgroundColor: "var(--status-installed, #1F4A3D)",
          color: "var(--status-installed-foreground, #80E6CC)",
          padding: "0.25rem 0.5rem",
          borderRadius: "0.375rem",
          fontSize: "0.75rem",
          fontWeight: "500",
          border: "1px solid rgba(16, 185, 129, 0.2)",
        },
        ".status-delivered": {
          backgroundColor: "var(--status-delivered, #2D4A5A)",
          color: "var(--status-delivered-foreground, #A6CCE8)",
          padding: "0.25rem 0.5rem",
          borderRadius: "0.375rem",
          fontSize: "0.75rem",
          fontWeight: "500",
          border: "1px solid rgba(59, 130, 246, 0.2)",
        },
        ".status-rejected": {
          backgroundColor: "var(--status-rejected, #7A1F1F)",
          color: "var(--status-rejected-foreground, #F2A6A6)",
          padding: "0.25rem 0.5rem",
          borderRadius: "0.375rem",
          fontSize: "0.75rem",
          fontWeight: "500",
          border: "1px solid rgba(239, 68, 68, 0.2)",
        },
        ".status-manufactured": {
          backgroundColor: "var(--status-manufactured, #5A3D2D)",
          color: "var(--status-manufactured-foreground, #E8C7A6)",
          padding: "0.25rem 0.5rem",
          borderRadius: "0.375rem",
          fontSize: "0.75rem",
          fontWeight: "500",
          border: "1px solid rgba(249, 115, 22, 0.2)",
        },
        ".status-inspected": {
          backgroundColor: "var(--status-inspected, #4A2D5A)",
          color: "var(--status-inspected-foreground, #C7A6E8)",
          padding: "0.25rem 0.5rem",
          borderRadius: "0.375rem",
          fontSize: "0.75rem",
          fontWeight: "500",
          border: "1px solid rgba(139, 92, 246, 0.2)",
        },
        ".status-online": {
          backgroundColor: "var(--status-complete, #2D5A3D)",
          color: "var(--status-complete-foreground, #A7E8B5)",
          padding: "0.25rem 0.5rem",
          borderRadius: "0.375rem",
          fontSize: "0.75rem",
          fontWeight: "500",
          border: "1px solid rgba(34, 197, 94, 0.3)",
        },
        ".status-offline": {
          backgroundColor: "var(--status-inactive, #5A2D31)",
          color: "var(--status-inactive-foreground, #D1B3B8)",
          padding: "0.25rem 0.5rem",
          borderRadius: "0.375rem",
          fontSize: "0.75rem",
          fontWeight: "500",
          border: "1px solid rgba(107, 114, 128, 0.3)",
        },

        // Role badges
        ".role-admin": {
          backgroundColor: "var(--primary, #C13B4A)",
          color: "var(--primary-foreground, #ffffff)",
          padding: "0.25rem 0.5rem",
          borderRadius: "0.375rem",
          fontSize: "0.75rem",
          fontWeight: "500",
        },
        ".role-manager": {
          backgroundColor: "var(--accent, #9B3340)",
          color: "var(--accent-foreground, #ffffff)",
          padding: "0.25rem 0.5rem",
          borderRadius: "0.375rem",
          fontSize: "0.75rem",
          fontWeight: "500",
        },
        ".role-user": {
          backgroundColor: "var(--secondary, #7A2531)",
          color: "var(--secondary-foreground, #ffffff)",
          padding: "0.25rem 0.5rem",
          borderRadius: "0.375rem",
          fontSize: "0.75rem",
          fontWeight: "500",
        },
        ".role-viewer": {
          backgroundColor: "var(--muted, #5A1A23)",
          color: "var(--muted-foreground, #D1B3B8)",
          padding: "0.25rem 0.5rem",
          borderRadius: "0.375rem",
          fontSize: "0.75rem",
          fontWeight: "500",
          border: "1px solid var(--border, #7A2531)",
        },

        // Touch targets
        ".touch-target": {
          minHeight: "44px",
          minWidth: "44px",
        },

        // Responsive spacing
        ".container-padding": {
          paddingLeft: "1rem",
          paddingRight: "1rem",
          "@media (min-width: 640px)": {
            paddingLeft: "1.5rem",
            paddingRight: "1.5rem",
          },
          "@media (min-width: 1024px)": {
            paddingLeft: "2rem",
            paddingRight: "2rem",
          },
        },

        // Safe area
        ".safe-area-top": {
          paddingTop: "env(safe-area-inset-top)",
        },
        ".safe-area-bottom": {
          paddingBottom: "env(safe-area-inset-bottom)",
        },

        // Scroll
        ".scroll-smooth": {
          scrollBehavior: "smooth",
          WebkitOverflowScrolling: "touch",
        },

        // No select
        ".no-select": {
          WebkitUserSelect: "none",
          MozUserSelect: "none",
          MsUserSelect: "none",
          userSelect: "none",
        },

        // Sticky header
        ".sticky-header": {
          position: "sticky",
          top: "0",
          zIndex: "50",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          background: "rgba(139, 38, 51, 0.95)",
        },

        // Avatar
        ".avatar-online-indicator": {
          position: "absolute",
          bottom: "-1px",
          right: "-1px",
          width: "12px",
          height: "12px",
          backgroundColor: "#22c55e",
          border: "2px solid hsl(var(--background))",
          borderRadius: "50%",
          "@media (max-width: 767px)": {
            width: "10px",
            height: "10px",
          },
        },

        // Mobile touch
        ".mobile-touch": {
          "@media (max-width: 767px)": {
            minHeight: "48px",
            paddingLeft: "1rem",
            paddingRight: "1rem",
            paddingTop: "0.75rem",
            paddingBottom: "0.75rem",
          },
        },

        // Popover animation
        ".popover-content-animate": {
          animation: "popover-in 0.15s cubic-bezier(0.16, 1, 0.3, 1)",
        },

        // Qatar fade-in
        ".qatar-fade-in": {
          animation: "fadeIn 0.3s ease-out",
        },
      });

      addComponents({
        // Qatar card
        ".qatar-card": {
          background: "linear-gradient(135deg, #5A1A23 0%, #4D1620 100%)",
          border: "1px solid var(--border, #7A2531)",
          borderRadius: "0.5rem",
          padding: "1.5rem",
          boxShadow:
            "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)",
        },
        ".qatar-card-header": {
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: "1rem",
        },
        ".qatar-card-title": {
          fontSize: "1.125rem",
          fontWeight: "600",
          color: "var(--foreground, #ffffff)",
          marginBottom: "0.5rem",
        },
        ".qatar-card-subtitle": {
          fontSize: "0.875rem",
          color: "var(--muted-foreground, #D1B3B8)",
          marginBottom: "0.25rem",
        },
        ".qatar-card-content": {
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
        },
        ".qatar-card-footer": {
          marginTop: "1rem",
          paddingTop: "1rem",
          borderTop: "1px solid hsla(var(--border, #7A2531) / 0.5)",
        },

        // Progress bars
        ".qatar-progress": {
          width: "100%",
          backgroundColor: "var(--secondary, #7A2531)",
          borderRadius: "9999px",
          height: "0.5rem",
        },
        ".qatar-progress-bar": {
          height: "0.5rem",
          backgroundColor: "var(--primary, #C13B4A)",
          borderRadius: "9999px",
          transition: "all 300ms",
        },

        // Search and filter
        ".qatar-search": {
          backgroundColor: "var(--input, #3D111A)",
          border: "1px solid var(--border, #7A2531)",
          borderRadius: "0.5rem",
          padding: "0.5rem 1rem",
          color: "var(--foreground, #ffffff)",
          "&::placeholder": {
            color: "var(--muted-foreground, #D1B3B8)",
          },
        },
        ".qatar-filter-btn": {
          padding: "0.5rem 1rem",
          borderRadius: "0.5rem",
          border: "1px solid var(--border, #7A2531)",
          backgroundColor: "var(--secondary, #7A2531)",
          color: "var(--secondary-foreground, #ffffff)",
          transition: "background-color 150ms",
          "&:hover": {
            backgroundColor: "var(--accent, #9B3340)",
          },
        },
        ".qatar-filter-btn-active": {
          backgroundColor: "var(--primary, #C13B4A)",
          color: "var(--primary-foreground, #ffffff)",
          border: "1px solid var(--primary, #C13B4A)",
        },

        // Sidebar
        ".qatar-sidebar": {
          background: "linear-gradient(180deg, #3D111A 0%, #2D0C14 100%)",
          borderRight: "1px solid var(--sidebar-border, #7A2531)",
        },
        ".qatar-sidebar-header": {
          padding: "1.5rem",
          borderBottom: "1px solid var(--sidebar-border, #7A2531)",
        },
        ".qatar-sidebar-brand": {
          fontSize: "1.25rem",
          fontWeight: "700",
          color: "var(--sidebar-foreground, #ffffff)",
        },
        ".qatar-sidebar-subtitle": {
          fontSize: "0.875rem",
          color: "hsla(var(--sidebar-foreground, #ffffff) / 0.7)",
        },
        ".qatar-nav-item": {
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          padding: "0.75rem 1rem",
          color: "var(--sidebar-foreground, #ffffff)",
          borderRadius: "0.5rem",
          transition: "background-color 150ms",
          "&:hover": {
            backgroundColor: "var(--sidebar-accent, #5A1A23)",
          },
        },
        ".qatar-nav-item-active": {
          backgroundColor: "var(--sidebar-primary, #C13B4A)",
          color: "var(--sidebar-primary-foreground, #ffffff)",
        },
      });
    },
  ],
};
