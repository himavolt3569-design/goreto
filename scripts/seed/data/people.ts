/**
 * Fictional-name pools. Names are combined at random, so any match with a real
 * person is coincidental. Grouping keeps first names and surnames plausible
 * together (e.g. Sherpa surnames with Sherpa given names).
 */

export type NameGroup = {
  weight: number;
  surnames: string[];
  female: string[];
  male: string[];
};

const commonFemale = [
  "Aarushi", "Priya", "Sneha", "Ananya", "Radhika", "Sita", "Gita", "Anjali", "Pooja", "Sunita",
  "Kabita", "Sabina", "Srijana", "Asmita", "Prakriti", "Samjhana", "Rojina", "Pratiksha", "Sushma",
  "Nisha", "Bipana", "Kritika", "Rashmi", "Shristi", "Aayusha", "Manisha", "Sarita", "Sangita",
  "Menuka", "Nirmala", "Alisha", "Trishna", "Barsha", "Isha", "Sadikshya", "Anisha", "Riya",
  "Smriti", "Jyoti", "Laxmi", "Kalpana", "Rekha", "Muna", "Pabitra", "Sabita", "Durga", "Urmila",
  "Sapana", "Rupa", "Anu", "Shreya", "Nikita", "Aakriti", "Prerana", "Sujata", "Binita", "Elina",
];

const commonMale = [
  "Rahul", "Vikram", "Aarav", "Suman", "Bibek", "Prabin", "Sujan", "Rajesh", "Ramesh", "Hari",
  "Krishna", "Bishal", "Sagar", "Nabin", "Dipesh", "Roshan", "Anish", "Sandeep", "Kiran", "Bikash",
  "Santosh", "Ashish", "Niraj", "Pradeep", "Utsav", "Saugat", "Aayush", "Sulav", "Kushal", "Manoj",
  "Deepak", "Rabin", "Yogesh", "Sanjay", "Ganesh", "Bijay", "Amrit", "Saroj", "Prajwal", "Nishan",
];

export const nameGroups: NameGroup[] = [
  {
    weight: 22,
    surnames: [
      "Shrestha", "Maharjan", "Bajracharya", "Shakya", "Tuladhar", "Manandhar", "Pradhan", "Joshi",
      "Amatya", "Dangol", "Rajbhandari", "Malla", "Karmacharya", "Dongol",
    ],
    female: commonFemale,
    male: commonMale,
  },
  {
    weight: 34,
    surnames: [
      "Sharma", "Adhikari", "Poudel", "Bhattarai", "Dahal", "Khanal", "Koirala", "Thapa", "Karki",
      "Basnet", "Khadka", "KC", "Bista", "Rana", "Oli", "Pandey", "Aryal", "Gautam", "Ghimire",
      "Neupane", "Subedi", "Timilsina", "Bhandari", "Acharya", "Regmi", "Lamichhane", "Pant",
    ],
    female: commonFemale,
    male: commonMale,
  },
  {
    weight: 22,
    surnames: [
      "Gurung", "Tamang", "Magar", "Rai", "Limbu", "Sunuwar", "Thakali", "Pun", "Ale", "Lama",
      "Ghale", "Subba",
    ],
    female: [...commonFemale, "Dolma", "Sonam", "Pasang", "Yangzi", "Jamuna"],
    male: [...commonMale, "Tenzing", "Pasang", "Sonam", "Dawa", "Bir"],
  },
  {
    weight: 5,
    surnames: ["Sherpa"],
    female: ["Dolma", "Lhamu", "Yangchen", "Pasang", "Phurba", "Ang", "Doma", "Chhiring"],
    male: ["Pemba", "Mingma", "Dawa", "Nima", "Lhakpa", "Tenzing", "Pasang", "Ang"],
  },
  {
    weight: 13,
    surnames: [
      "Yadav", "Jha", "Mandal", "Shah", "Sah", "Mishra", "Thakur", "Singh", "Gupta", "Karn",
      "Chaudhary", "Das",
    ],
    female: ["Pooja", "Priyanka", "Neha", "Anjali", "Kajal", "Nandini", "Suman", "Ritu", "Rani", "Kiran"],
    male: ["Ramesh", "Sanjay", "Amit", "Rakesh", "Sunil", "Pawan", "Manish", "Rohit", "Vivek", "Arjun"],
  },
  {
    weight: 4,
    surnames: ["Chaudhary", "Tharu", "Kathariya", "Rana"],
    female: ["Sita", "Rita", "Sunita", "Kalpana", "Sarita", "Anita", "Maya"],
    male: ["Ram", "Shyam", "Bikram", "Hari", "Rajan", "Dilip", "Kamal"],
  },
];

/** Reserved example domains (RFC 2606): nothing in the seed is deliverable. */
export const EMAIL_DOMAINS = ["example.com", "example.net", "example.org"] as const;

/** Nepal mobile prefixes (NTC 984–986, Ncell 980–982, NTC 974–976). */
export const MOBILE_PREFIXES = ["980", "981", "982", "984", "985", "986", "974", "975", "976"];
