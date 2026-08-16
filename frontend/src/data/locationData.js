export const STATES = [
  'Tamil Nadu',
  'Karnataka',
  'Kerala',
  'Andhra Pradesh',
  'Telangana',
  'Maharashtra',
  'Gujarat',
  'Delhi',
  'Rajasthan',
  'Uttar Pradesh',
  'Madhya Pradesh',
  'West Bengal',
  'Punjab',
  'Haryana',
  'Bihar',
  'Odisha',
  'Assam',
  'Puducherry',
  'Goa',
  'Jharkhand',
  'Chhattisgarh',
  'Uttarakhand',
  'Himachal Pradesh'
];

export const CITIES_BY_STATE = {
  'Tamil Nadu': [
    'Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 'Tirunelveli', 'Erode',
    'Vellore', 'Thoothukudi', 'Dindigul', 'Thanjavur', 'Ranipet', 'Sivakasi', 'Karur',
    'Udhagamandalam (Ooty)', 'Hosur', 'Nagercoil', 'Kanchipuram', 'Kumarapalayam', 'Karaikkudi',
    'Neyveli', 'Cuddalore', 'Kumbakonam', 'Tiruvannamalai', 'Pollachi', 'Rajapalayam', 'Gudiyatham', 'Pudukkottai'
  ],
  'Karnataka': [
    'Bengaluru', 'Mysuru', 'Hubballi-Dharwad', 'Mangaluru', 'Belagavi', 'Kalaburagi', 'Davanagere',
    'Ballari', 'Vijayapura', 'Shivamogga', 'Tumakuru', 'Raichur', 'Bidar', 'Hosapete', 'Udupi'
  ],
  'Kerala': [
    'Thiruvananthapuram', 'Kochi', 'Kozhikode', 'Kollam', 'Thrissur', 'Kannur', 'Alappuzha',
    'Kottayam', 'Palakkad', 'Manjeri', 'Thalassery', 'Ponnani'
  ],
  'Maharashtra': [
    'Mumbai', 'Pune', 'Nagpur', 'Thane', 'Nashik', 'Kalyan-Dombivli', 'Vasai-Virar', 'Aurangabad',
    'Navi Mumbai', 'Solapur', 'Mira-Bhayandar', 'Kolhapur', 'Amravati', 'Nanded'
  ],
  'Gujarat': [
    'Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar', 'Jamnagar', 'Junagadh', 'Gandhinagar'
  ],
  'Delhi': [
    'New Delhi', 'North Delhi', 'South Delhi', 'East Delhi', 'West Delhi', 'Central Delhi'
  ],
  'Telangana': [
    'Hyderabad', 'Warangal', 'Nizamabad', 'Khammam', 'Karimnagar', 'Ramagundam'
  ],
  'Andhra Pradesh': [
    'Visakhapatnam', 'Vijayawada', 'Guntur', 'Nellore', 'Kurnool', 'Kakinada', 'Rajahmundry', 'Tirupati'
  ]
};

export const AREAS_BY_CITY = {
  'Chennai': [
    'T. Nagar', 'Anna Nagar', 'Adyar', 'Velachery', 'Mylapore', 'Guindy', 'Tambaram',
    'Chromepet', 'Nungambakkam', 'Porur', 'Alwarpet', 'Kilpauk', 'Kodambakkam', 'Perambur',
    'Saidapet', 'Sholinganallur', 'Thiruvanmiyur', 'Egmore', 'Royapettah', 'Besant Nagar', 'Pallavaram'
  ],
  'Coimbatore': [
    'RS Puram', 'Gandhipuram', 'Peelamedu', 'Saibaba Colony', 'Singanallur', 'Saravanampatti',
    'Ramanathapuram', 'Ukkadam', 'Vadavalli', 'Thudiyalur', 'Ganapathy', 'Kovaipudur', 'Sundarapuram'
  ],
  'Madurai': [
    'KK Nagar', 'Anna Nagar', 'Simmakkal', 'Goripalayam', 'Tallakulam', 'Mattuthavani',
    'Villapuram', 'Tirupparankundram', 'Sellur', 'Teppakulam', 'South Gate', 'Palanganatham'
  ],
  'Tiruchirappalli': [
    'Thillai Nagar', 'Cantonment', 'Srirangam', 'K.K. Nagar', 'Woraiyur', 'Ponmalai', 'Palakkarai'
  ],
  'Salem': [
    'Fairlands', 'Alagapuram', 'Suramangalam', 'Hasthampatti', 'Ammapet', 'Shevapet', 'Gugai'
  ],
  'Erode': [
    'Perundurai Road', 'Brough Road', 'Surampatti', 'Veerappanchatram', 'Thindal', 'Kasipalayam'
  ],
  'Bengaluru': [
    'Koramangala', 'Indiranagar', 'Jayanagar', 'Whitefield', 'HSR Layout', 'Electronic City',
    'BTM Layout', 'JP Nagar', 'Malleshwaram', 'Rajajinagar', 'Marathahalli', 'Hebbal', 'Yelahanka'
  ],
  'Kochi': [
    'MG Road', 'Edappally', 'Kaloor', 'Palarivattom', 'Fort Kochi', 'Marine Drive', 'Kakkanad', 'Aluva'
  ],
  'Mumbai': [
    'Andheri', 'Bandra', 'Borivali', 'Dadar', 'Juhu', 'Colaba', 'Goregaon', 'Malad', 'Powai', 'Kurla', 'Thane'
  ],
  'New Delhi': [
    'Connaught Place', 'Karol Bagh', 'Lajpat Nagar', 'South Extension', 'Hauz Khas', 'Saket', 'Dwarka', 'Rohini'
  ]
};

export const PINCODE_DIRECTORY = {
  // Chennai
  '600001': { state: 'Tamil Nadu', city: 'Chennai', area: 'Parrys / George Town' },
  '600002': { state: 'Tamil Nadu', city: 'Chennai', area: 'Anna Salai' },
  '600004': { state: 'Tamil Nadu', city: 'Chennai', area: 'Mylapore' },
  '600017': { state: 'Tamil Nadu', city: 'Chennai', area: 'T. Nagar' },
  '600018': { state: 'Tamil Nadu', city: 'Chennai', area: 'Alwarpet' },
  '600020': { state: 'Tamil Nadu', city: 'Chennai', area: 'Adyar' },
  '600028': { state: 'Tamil Nadu', city: 'Chennai', area: 'R.A. Puram' },
  '600034': { state: 'Tamil Nadu', city: 'Chennai', area: 'Nungambakkam' },
  '600040': { state: 'Tamil Nadu', city: 'Chennai', area: 'Anna Nagar' },
  '600042': { state: 'Tamil Nadu', city: 'Chennai', area: 'Velachery' },
  '600045': { state: 'Tamil Nadu', city: 'Chennai', area: 'Tambaram' },
  '600083': { state: 'Tamil Nadu', city: 'Chennai', area: 'Ashok Nagar' },
  '600096': { state: 'Tamil Nadu', city: 'Chennai', area: 'Perungudi' },
  '600119': { state: 'Tamil Nadu', city: 'Chennai', area: 'Sholinganallur' },

  // Coimbatore
  '641001': { state: 'Tamil Nadu', city: 'Coimbatore', area: 'Town Hall' },
  '641002': { state: 'Tamil Nadu', city: 'Coimbatore', area: 'RS Puram' },
  '641004': { state: 'Tamil Nadu', city: 'Coimbatore', area: 'Peelamedu' },
  '641006': { state: 'Tamil Nadu', city: 'Coimbatore', area: 'Ganapathy' },
  '641011': { state: 'Tamil Nadu', city: 'Coimbatore', area: 'Saibaba Colony' },
  '641012': { state: 'Tamil Nadu', city: 'Coimbatore', area: 'Gandhipuram' },
  '641018': { state: 'Tamil Nadu', city: 'Coimbatore', area: 'Ramanathapuram' },
  '641035': { state: 'Tamil Nadu', city: 'Coimbatore', area: 'Saravanampatti' },
  '641045': { state: 'Tamil Nadu', city: 'Coimbatore', area: 'Ramanathapuram' },

  // Madurai
  '625001': { state: 'Tamil Nadu', city: 'Madurai', area: 'Town' },
  '625002': { state: 'Tamil Nadu', city: 'Madurai', area: 'Tallakulam' },
  '625020': { state: 'Tamil Nadu', city: 'Madurai', area: 'KK Nagar' },

  // Salem & Erode
  '636001': { state: 'Tamil Nadu', city: 'Salem', area: 'Salem Town' },
  '636007': { state: 'Tamil Nadu', city: 'Salem', area: 'Fairlands' },
  '638001': { state: 'Tamil Nadu', city: 'Erode', area: 'Erode Town' },
  '638011': { state: 'Tamil Nadu', city: 'Erode', area: 'Thindal' },

  // Bengaluru
  '560001': { state: 'Karnataka', city: 'Bengaluru', area: 'MG Road' },
  '560034': { state: 'Karnataka', city: 'Bengaluru', area: 'Koramangala' },
  '560038': { state: 'Karnataka', city: 'Bengaluru', area: 'Indiranagar' },
  '560041': { state: 'Karnataka', city: 'Bengaluru', area: 'Jayanagar' },
  '560066': { state: 'Karnataka', city: 'Bengaluru', area: 'Whitefield' },
  '560102': { state: 'Karnataka', city: 'Bengaluru', area: 'HSR Layout' },

  // Mumbai
  '400001': { state: 'Maharashtra', city: 'Mumbai', area: 'Fort' },
  '400050': { state: 'Maharashtra', city: 'Mumbai', area: 'Bandra West' },
  '400053': { state: 'Maharashtra', city: 'Mumbai', area: 'Andheri West' },

  // Delhi
  '110001': { state: 'Delhi', city: 'New Delhi', area: 'Connaught Place' },
  '110024': { state: 'Delhi', city: 'New Delhi', area: 'Lajpat Nagar' }
};

export function lookupPincode(pin) {
  if (!pin) return null;
  const clean = String(pin).trim();
  if (PINCODE_DIRECTORY[clean]) {
    return PINCODE_DIRECTORY[clean];
  }
  // Generic state inference based on first 2 digits of Indian pincodes
  if (clean.length === 6) {
    const prefix2 = clean.substring(0, 2);
    if (['60', '61', '62', '63', '64'].includes(prefix2)) return { state: 'Tamil Nadu', city: '', area: '' };
    if (['56', '57', '58', '59'].includes(prefix2)) return { state: 'Karnataka', city: '', area: '' };
    if (['67', '68', '69'].includes(prefix2)) return { state: 'Kerala', city: '', area: '' };
    if (['50', '51', '52', '53'].includes(prefix2)) return { state: 'Andhra Pradesh', city: '', area: '' };
    if (['40', '41', '42', '43', '44'].includes(prefix2)) return { state: 'Maharashtra', city: '', area: '' };
    if (['38', '39'].includes(prefix2)) return { state: 'Gujarat', city: '', area: '' };
    if (['11'].includes(prefix2)) return { state: 'Delhi', city: 'New Delhi', area: '' };
    if (['30', '31', '32', '33', '34'].includes(prefix2)) return { state: 'Rajasthan', city: '', area: '' };
    if (['20', '21', '22', '23', '24', '25', '26', '27', '28'].includes(prefix2)) return { state: 'Uttar Pradesh', city: '', area: '' };
    if (['70', '71', '72', '73', '74'].includes(prefix2)) return { state: 'West Bengal', city: '', area: '' };
  }
  return null;
}
