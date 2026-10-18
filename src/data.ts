export type Category = 'coffee' | 'food' | 'snacks'

export interface Product {
  id: string
  name: string
  category: Category
  price: number
  // Products the business marked for bonus points.
  bonusPoints?: number
}

export interface Branch {
  id: string
  name: string
  address: string
  lat: number
  lng: number
}

// Placeholder data. Replace with the real menu, prices and branches.
export const products: Product[] = [
  { id: 'esp', name: 'Espresso', category: 'coffee', price: 35, bonusPoints: 5 },
  { id: 'cap', name: 'Cappuccino', category: 'coffee', price: 55, bonusPoints: 10 },
  { id: 'latte', name: 'Latte', category: 'coffee', price: 60, bonusPoints: 10 },
  { id: 'cin', name: 'Cinnamon Roll', category: 'food', price: 45, bonusPoints: 8 },
  { id: 'sand', name: 'Chicken Sandwich', category: 'food', price: 85 },
  { id: 'chips', name: 'Chips', category: 'snacks', price: 20 },
]

// Placeholder coordinates for two New Cairo / Cairo locations.
export const branches: Branch[] = [
  {
    id: 'akhnaton',
    name: 'Akhnaton St - New Cairo',
    address: 'Mobil Station, Akhnaton St, 5th Settlement',
    lat: 30.0074,
    lng: 31.4913,
  },
  {
    id: 'zamalek',
    name: 'Zamalek',
    address: 'Mobil Station, Zamalek, Cairo',
    lat: 30.0609,
    lng: 31.2194,
  },
]
