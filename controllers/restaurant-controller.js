const { Restaurant, Category } = require('../models')

const restaurantController = {
  getRestaurants: async (req, res, next) => {
    try {
      const categoryId = Number(req.query.categoryId) || ''

      const [restaurants, categories] = await Promise.all([
        Restaurant.findAll({
          raw: true,
          nest: true,
          where: {
            ...categoryId ? { categoryId } : {}
          },
          include: [Category]
        }),
        Category.findAll({ raw: true })
      ])
      const revisedRestaurants = restaurants.map(res => ({
        ...res,
        description: res.description.substring(0, 50)
      }))

      return res.render('restaurants', { restaurants: revisedRestaurants, categories, categoryId })
    } catch (err) {
      next(err)
    }
  },
  getRestaurant: async (req, res, next) => {
    try {
      const { id } = req.params
      const restaurant = await Restaurant.findByPk(id, {
        nest: true,
        include: [Category]
      })
      if (!restaurant) throw new Error('該餐廳不存在！')

      await restaurant.increment('view_counts')

      return res.render('restaurant', { restaurant: restaurant.toJSON() })
    } catch (err) {
      next(err)
    }
  },
  getDashboard: async (req, res, next) => {
    try {
      const { id } = req.params
      const restaurant = await Restaurant.findByPk(id, {
        raw: true,
        nest: true,
        include: [Category]
      })
      if (!restaurant) throw new Error('該餐廳不存在！')

      res.render('dashboard', { restaurant })
    } catch (err) {
      next(err)
    }
  }
}

module.exports = restaurantController
