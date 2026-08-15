export type Property = {
  id: string
  slug: string
  location: string | null
  property_type: string | null
  size: string | null
  size_sqft: number | null
  price_pkr: number | null
  status: string
  dimensions_length_ft: number | null
  dimensions_width_ft: number | null
  plot_shape: string | null
  is_constructed: boolean | null
  construction_age_years: number | null
  is_corner_plot: boolean | null
  has_extra_land: boolean | null
  extra_land_sqft: number | null
  proximity_markaz: string | null
  proximity_park: string | null
  near_main_road: boolean | null
  facing_direction: string | null
  created_at: string
  latitude: number | null
  longitude: number | null
  address: string | null
  description: string | null
  bedrooms: number | null
  bathrooms: number | null
  sub_locality: string | null
}

export type PropertyMedia = {
  id: string
  property_id: string
  media_type: string
  url: string
  position: number
  is_cover: boolean
}

export type PropertyFilters = {
  location?: string
  property_type?: string
  min_price?: number
  max_price?: number
}

export type Project = {
  id: string
  slug: string
  project_name: string | null
  location: string | null
  size_sqft: number | null
  status: string
  public_description: string | null
  cover_image_url: string | null
  expected_end_date: string | null
}

export type ProjectMedia = {
  id: string
  project_id: string
  media_type: string
  url: string
  position: number
}
