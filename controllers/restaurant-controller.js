const { Op } = require('sequelize')
const { Restaurant, Category, Comment, User, Favorite, sequelize } = require('../models')
const { getOffset, getPagination } = require('../helpers/pagination-helper')

const restaurantController = {
  getRestaurants: async (req, res, next) => {
    try {
      const DEFAULT_LIMIT = 9
      const categoryId = Number(req.query.categoryId) || ''

      const page = Number(req.query.page) || 1
      const limit = Number(req.query.limit) || DEFAULT_LIMIT
      const offset = getOffset(limit, page)

      const [restaurants, categories] = await Promise.all([
        Restaurant.findAndCountAll({
          raw: true,
          nest: true,
          limit,
          offset,
          where: {
            ...categoryId ? { categoryId } : {}
          },
          include: [Category]
        }),
        Category.findAll({ raw: true })
      ])

      const favoritedRestaurantsId = req.user?.FavoritedRestaurants.map(fr => fr.id) || []

      const likedRestaurantsId = req.user?.LikedRestaurants.map(lr => lr.id) || []

      const revisedRestaurants = restaurants.rows.map(res => ({
        ...res,
        description: res.description.substring(0, 50),
        isFavorited: favoritedRestaurantsId.includes(res.id),
        isLiked: likedRestaurantsId.includes(res.id)
      }))

      return res.render('restaurants', {
        restaurants: revisedRestaurants,
        categories,
        categoryId,
        pagination: getPagination(limit, page, restaurants.count)
      })
    } catch (err) {
      next(err)
    }
  },
  getRestaurant: async (req, res, next) => {
    try {
      const { id } = req.params
      const restaurant = await Restaurant.findByPk(id, {
        include: [Category,
          { model: User, as: 'FavoritedUsers' },
          { model: User, as: 'LikedUsers' }
        ]
      })
      if (!restaurant) throw new Error('該餐廳不存在！')

      const comments = await Comment.findAll({
        where: { restaurantId: id },
        order: [
          ['created_at', 'DESC']
        ],
        include: [User],
        raw: true,
        nest: true
      })

      await restaurant.increment('viewCounts')

      const isFavorited = restaurant.FavoritedUsers.some(fu => fu.id === req.user.id)
      const isLiked = restaurant.LikedUsers.some(lu => lu.id === req.user.id)

      return res.render('restaurant', {
        restaurant: restaurant.toJSON(),
        isFavorited,
        isLiked,
        comments
      })
    } catch (err) {
      next(err)
    }
  },
  getDashboard: async (req, res, next) => {
    try {
      const restaurantId = req.params.id
      const restaurant = await Restaurant.findByPk(restaurantId, {
        raw: true,
        nest: true,
        include: [Category]
      })

      if (!restaurant) throw new Error('該餐廳不存在！')

      const [comment, favorite] = await Promise.all([
        Comment.findAndCountAll({
          where: { restaurantId },
          raw: true,
          nest: true
        }),
        Favorite.findAndCountAll({
          where: { restaurantId },
          raw: true,
          nest: true
        })
      ])

      res.render('dashboard', { restaurant, comments: comment.count, favorites: favorite.count })
    } catch (err) {
      next(err)
    }
  },
  getFeeds: async (req, res, next) => {
    try {
      const [restaurants, comments] = await Promise.all([
        Restaurant.findAll({
          limit: 10,
          raw: true,
          nest: true,
          include: [Category],
          order: [['createdAt', 'DESC']]
        }),
        Comment.findAll({
          limit: 10,
          raw: true,
          nest: true,
          include: [Restaurant, User],
          order: [['createdAt', 'DESC']]
        })
      ])

      return res.render('feeds', { restaurants, comments })
    } catch (err) {
      next(err)
    }
  },
  getTopRestaurants: async (req, res, next) => {
    try {
      const LIMIT = 10
      const rawFavoritedRestaurant = await Favorite.findAll({
        attributes: [
          'restaurant_id',
          [
            sequelize.fn('COUNT', sequelize.col('user_id')), 'favorited_user_counts'
          ]
        ],
        group: ['restaurant_id'],
        order: [
          [sequelize.literal('favorited_user_counts'), 'DESC']
        ],
        limit: LIMIT,
        raw: true,
        nest: true
      })

      const FavoritedRestaurantId = rawFavoritedRestaurant.map(res => res.restaurant_id)
      const rawRestaurants = []

      for (let i = 0; i < FavoritedRestaurantId.length; i++) {
        const restaurant = await Restaurant.findOne({
          where: { id: FavoritedRestaurantId[i] },
          include: [{ model: User, as: 'FavoritedUsers' }]
        })
        rawRestaurants.push(restaurant.toJSON())
      }

      // 撈出的資料不為十筆
      if (rawFavoritedRestaurant.length !== LIMIT) {
        const number = LIMIT - rawFavoritedRestaurant.length
        const restaurant = await Restaurant.findAll({
          where: {
            id: {
              [Op.notIn]: FavoritedRestaurantId
            }
          },
          include: [{ model: User, as: 'FavoritedUsers' }],
          limit: number,
          raw: true,
          nest: true
        })
        rawRestaurants.push(...restaurant)
      }

      const restaurants = rawRestaurants
        .map(res => ({
          ...res,
          favoritedCount: res.FavoritedUsers?.length || 0,
          isFavorited: req.user?.FavoritedRestaurants.some(fr => fr.id === res.id) || []
        }))

      return res.render('top-restaurants', { restaurants })
    } catch (err) {
      next(err)
    }
  }
}

module.exports = restaurantController
