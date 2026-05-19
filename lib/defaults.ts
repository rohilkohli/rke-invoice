export const DEFAULT_COMPANY = {
  companyName: "M/S Radha Kishan Enterprises",
  gstin: "09ABCFR1989E1ZX",
  address: "Plot No. 365 Sec. 6 Transport Nagar, Agra - 282007",
  email: "agranitinkohli@gmail.com",
  phone: "7500530053 / 6397894347",
  bankName: "IDFC Bank Ltd.",
  branch: "Agra",
  accountNo: "10126129701",
  ifsc: "IDFB0021291",
  upiId: "agranitinkohli@gmail.com",
  invoicePrefix: `RKE-${new Date().getFullYear()}-`,
  defaultCgstRate: 9,
  defaultSgstRate: 9,
  defaultIgstRate: 18,
  termsAndConditions: [
    "Payment to be made within 7 days from invoice date.",
    "All disputes are subject to Agra jurisdiction only.",
    "E. & O.E.",
    "Certified that the particulars given above are true and correct.",
  ].join("\n"),
} as const;

export const DEFAULT_CLIENT = {
  name: "Larsen & Toubro Limited — L&T Energy Hydrocarbon",
  address:
    "14th Floor AMN Tower, Jogeshwari-Vikroli Link Road, Powai, Mumbai 400072",
  gstin: "27AAACL0140PEZ6",
  state: "Maharashtra",
  stateCode: "27",
  shipToName: "RIL",
  shipToAddress:
    "Survey No 135-137, Nagothane Manufacturing Division, SH-86, Nagothane, Raigad, Maharashtra 402125",
} as const;

export const DEFAULT_COMPANY_STATE = {
  state: "Uttar Pradesh",
  stateCode: "09",
} as const;

