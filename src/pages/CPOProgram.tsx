/**
 * CPO (Certified Pre-Owned) Program Page
 * Browse certified vehicles and learn about the certification process
 */

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Shield, CheckCircle, Award, Car, Calendar, Gauge, MapPin, Phone, Mail, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/services/api';
import { formatPrice } from '@/lib/utils';

interface CPOListing {
  id: string;
  listing_id: string;
  make: string;
  model: string;
  year: number;
  price: number;
  mileage: number;
  location: string;
  image_url: string;
  certification_level: string;
  warranty_months: number;
  warranty_km: number;
  inspection_score: number;
  certificate_number: string;
}

const WARRANTY_TIERS = [
  {
    name: 'Basic',
    months: 3,
    km: 5000,
    price: 15000,
    features: ['Engine coverage', 'Transmission coverage', '24/7 roadside assistance'],
  },
  {
    name: 'Standard',
    months: 6,
    km: 10000,
    price: 25000,
    features: ['Everything in Basic', 'Electrical systems', 'AC system', 'Free pickup & drop'],
    popular: true,
  },
  {
    name: 'Premium',
    months: 12,
    km: 20000,
    price: 45000,
    features: ['Everything in Standard', 'Suspension coverage', 'Brake system', 'Annual free service'],
  },
  {
    name: 'Extended',
    months: 24,
    km: 40000,
    price: 75000,
    features: ['Comprehensive coverage', 'Wear & tear included', 'Replacement vehicle', 'Priority support'],
  },
];

const INSPECTION_CATEGORIES = [
  { name: 'Engine', items: 8, icon: '🔧' },
  { name: 'Transmission', items: 4, icon: '⚙️' },
  { name: 'Brakes', items: 5, icon: '🛑' },
  { name: 'Suspension', items: 5, icon: '〰️' },
  { name: 'Electrical', items: 8, icon: '⚡' },
  { name: 'Body', items: 5, icon: '🚗' },
  { name: 'Interior', items: 5, icon: '💺' },
  { name: 'Tires', items: 4, icon: '🛞' },
  { name: 'Fluids', items: 5, icon: '💧' },
  { name: 'Safety', items: 5, icon: '🛡️' },
];

export default function CPOProgram() {
  const [selectedTier, setSelectedTier] = useState('standard');
  const [searchFilters, setSearchFilters] = useState({
    make: '',
    model: '',
    maxPrice: '',
    location: '',
  });

  const { data: cpoListings, isLoading } = useQuery<CPOListing[]>({
    queryKey: ['cpo-listings', searchFilters],
    queryFn: () => api.getCPOListings(searchFilters),
  });

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Hero Section */}
      <section className="text-center mb-12">
        <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-800 px-4 py-2 rounded-full mb-4">
          <Shield className="w-5 h-5" />
          <span className="font-semibold">Motormila Certified Pre-Owned</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold mb-4">
          Buy with Confidence
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-6">
          Every CPO vehicle undergoes a rigorous 150-point inspection and comes with 
          comprehensive warranty coverage for your peace of mind.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Button size="lg" className="gap-2">
            <Car className="w-5 h-5" />
            Browse Certified Cars
          </Button>
          <Button size="lg" variant="outline" className="gap-2">
            <Award className="w-5 h-5" />
            Learn About Certification
          </Button>
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
        <Card>
          <CardContent className="pt-6 text-center">
            <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-2" />
            <div className="text-3xl font-bold">150+</div>
            <div className="text-sm text-muted-foreground">Inspection Points</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <Award className="w-12 h-12 text-blue-600 mx-auto mb-2" />
            <div className="text-3xl font-bold">100%</div>
            <div className="text-sm text-muted-foreground">Verified History</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <Calendar className="w-12 h-12 text-purple-600 mx-auto mb-2" />
            <div className="text-3xl font-bold">Up to 24</div>
            <div className="text-sm text-muted-foreground">Months Warranty</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <Gauge className="w-12 h-12 text-orange-600 mx-auto mb-2" />
            <div className="text-3xl font-bold">92+</div>
            <div className="text-sm text-muted-foreground">Avg. Inspection Score</div>
          </CardContent>
        </Card>
      </section>

      <Tabs defaultValue="listings" className="mb-12">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="listings">Certified Listings</TabsTrigger>
          <TabsTrigger value="process">Certification Process</TabsTrigger>
          <TabsTrigger value="warranty">Warranty Plans</TabsTrigger>
        </TabsList>

        {/* Certified Listings Tab */}
        <TabsContent value="listings" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Browse Certified Vehicles</CardTitle>
              <CardDescription>
                All vehicles have passed our 150-point inspection with verified history
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div>
                  <Label htmlFor="make">Make</Label>
                  <Select onValueChange={(v) => setSearchFilters({...searchFilters, make: v})}>
                    <SelectTrigger><SelectValue placeholder="Any Make" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="toyota">Toyota</SelectItem>
                      <SelectItem value="honda">Honda</SelectItem>
                      <SelectItem value="nissan">Nissan</SelectItem>
                      <SelectItem value="suzuki">Suzuki</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="model">Model</Label>
                  <Input 
                    id="model" 
                    placeholder="Any Model"
                    onChange={(e) => setSearchFilters({...searchFilters, model: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="maxPrice">Max Price</Label>
                  <Select onValueChange={(v) => setSearchFilters({...searchFilters, maxPrice: v})}>
                    <SelectTrigger><SelectValue placeholder="No Limit" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5000000">Rs. 5M</SelectItem>
                      <SelectItem value="7500000">Rs. 7.5M</SelectItem>
                      <SelectItem value="10000000">Rs. 10M</SelectItem>
                      <SelectItem value="15000000">Rs. 15M</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="location">Location</Label>
                  <Select onValueChange={(v) => setSearchFilters({...searchFilters, location: v})}>
                    <SelectTrigger><SelectValue placeholder="Anywhere" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="colombo">Colombo</SelectItem>
                      <SelectItem value="kandy">Kandy</SelectItem>
                      <SelectItem value="galle">Galle</SelectItem>
                      <SelectItem value="kurunegala">Kurunegala</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Listings Grid */}
              {isLoading ? (
                <div className="text-center py-12">Loading certified vehicles...</div>
              ) : cpoListings && cpoListings.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {cpoListings.map((listing) => (
                    <Card key={listing.id} className="overflow-hidden">
                      <div className="aspect-video bg-gray-200 relative">
                        <img 
                          src={listing.image_url} 
                          alt={`${listing.year} ${listing.make} ${listing.model}`}
                          className="w-full h-full object-cover"
                        />
                        <Badge className="absolute top-2 right-2 bg-green-600">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          CPO Certified
                        </Badge>
                      </div>
                      <CardHeader>
                        <CardTitle className="text-lg">
                          {listing.year} {listing.make} {listing.model}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          {listing.location}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Mileage:</span>
                            <span className="font-medium">{listing.mileage.toLocaleString()} km</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Warranty:</span>
                            <span className="font-medium">{listing.warranty_months} mo / {listing.warranty_km.toLocaleString()} km</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Inspection Score:</span>
                            <span className="font-medium text-green-600">{listing.inspection_score}/100</span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Certificate: {listing.certificate_number}
                          </div>
                        </div>
                      </CardContent>
                      <CardFooter className="flex justify-between">
                        <div className="text-xl font-bold text-primary">
                          {formatPrice(listing.price)}
                        </div>
                        <Button>View Details</Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  No certified vehicles found matching your criteria
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Certification Process Tab */}
        <TabsContent value="process" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Our 150-Point Inspection Process</CardTitle>
              <CardDescription>
                Every vehicle undergoes a comprehensive multi-category inspection
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                {INSPECTION_CATEGORIES.map((category) => (
                  <Card key={category.name}>
                    <CardContent className="pt-4 text-center">
                      <div className="text-3xl mb-2">{category.icon}</div>
                      <div className="font-semibold text-sm">{category.name}</div>
                      <div className="text-xs text-muted-foreground">{category.items} checks</div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">1</div>
                  <div>
                    <h3 className="font-semibold text-lg">Initial Assessment</h3>
                    <p className="text-muted-foreground">
                      Vehicle documentation verification, VIN check, and ownership history review
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">2</div>
                  <div>
                    <h3 className="font-semibold text-lg">Comprehensive Inspection</h3>
                    <p className="text-muted-foreground">
                      Certified inspectors perform 150+ point checks across all vehicle systems
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">3</div>
                  <div>
                    <h3 className="font-semibold text-lg">Score Calculation</h3>
                    <p className="text-muted-foreground">
                      Overall score calculated based on pass/fail results and issue severity
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">4</div>
                  <div>
                    <h3 className="font-semibold text-lg">Certification Decision</h3>
                    <p className="text-muted-foreground">
                      Vehicles scoring 85%+ with no critical issues receive CPO certification
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">5</div>
                  <div>
                    <h3 className="font-semibold text-lg">Warranty Issuance</h3>
                    <p className="text-muted-foreground">
                      Choose your warranty tier and receive official certification documents
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Warranty Plans Tab */}
        <TabsContent value="warranty" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {WARRANTY_TIERS.map((tier) => (
              <Card key={tier.name} className={`relative ${tier.popular ? 'border-blue-600 border-2' : ''}`}>
                {tier.popular && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600">
                    Most Popular
                  </Badge>
                )}
                <CardHeader className="text-center">
                  <CardTitle>{tier.name}</CardTitle>
                  <div className="text-3xl font-bold text-primary mt-2">
                    Rs. {tier.price.toLocaleString()}
                  </div>
                  <CardDescription className="mt-2">
                    {tier.months} Months / {tier.km.toLocaleString()} km
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {tier.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button className="w-full" variant={tier.popular ? 'default' : 'outline'}>
                    Select Plan
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>

          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Need Help Choosing?</CardTitle>
              <CardDescription>
                Our experts are here to help you select the right warranty plan
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <Phone className="w-12 h-12 text-blue-600 mx-auto mb-2" />
                  <div className="font-semibold">Call Us</div>
                  <div className="text-muted-foreground">+94 11 234 5678</div>
                </div>
                <div className="text-center">
                  <Mail className="w-12 h-12 text-blue-600 mx-auto mb-2" />
                  <div className="font-semibold">Email Us</div>
                  <div className="text-muted-foreground">cpo@motormila.lk</div>
                </div>
                <div className="text-center">
                  <MapPin className="w-12 h-12 text-blue-600 mx-auto mb-2" />
                  <div className="font-semibold">Visit Us</div>
                  <div className="text-muted-foreground">Colombo 7, Sri Lanka</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* How It Works */}
      <section className="mb-12">
        <h2 className="text-3xl font-bold text-center mb-8">How CPO Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="font-semibold text-lg mb-2">1. Find Your Car</h3>
              <p className="text-muted-foreground">
                Browse our curated selection of certified pre-owned vehicles that meet your needs
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="font-semibold text-lg mb-2">2. Verify Certification</h3>
              <p className="text-muted-foreground">
                Review the detailed inspection report and choose your preferred warranty plan
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center mx-auto mb-4">
                <Car className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="font-semibold text-lg mb-2">3. Drive Away</h3>
              <p className="text-muted-foreground">
                Complete purchase with confidence knowing you're covered by comprehensive warranty
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
