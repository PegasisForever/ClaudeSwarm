import { heroui, commonColors } from "@heroui/react"
export default heroui({
  addCommonColors: false,
  defaultTheme: "dark",
  themes: {
    dark: {
      colors: {
        primary: {
          ...commonColors.purple,
        },
      },
    },
  },
})
