import { useRxQuery } from './useRxQuery.js'
import { useDB } from '../contexts/DBContext.jsx'

/**
 * useConfig - Hook to access main document of config collection.
 */
export function useConfig() {
  const { db } = useDB()
  
  // Always call useRxQuery — pass null query when DB not ready (hook handles null)
  const { result: config, loading, error } = useRxQuery(
    db ? db.config.findOne('main') : null,
    { live: true, isDoc: true }
  )

  /**
   * updateConfig - Updates the config document with new values.
   * @param {Object} updates - The fields to update.
   */
  const updateConfig = async (updates) => {
    if (!db) throw new Error('Database not ready')
    const configDoc = await db.config.findOne('main').exec()
    if (configDoc) {
      await configDoc.patch({ ...updates, updated_at: new Date().toISOString() })
    } else {
      throw new Error('Config not found')
    }
  }

  /**
   * isPluginEnabled - Checks if a plugin is currently enabled in config.
   * @param {string} pluginName - The name of the plugin (e.g., 'inventory', 'production').
   */
  const isPluginEnabled = (pluginName) => {
    return config?.modules?.[pluginName] === true
  }

  /**
   * getLabel - Gets the custom field label for a specific entity and slot.
   * @param {string} entity - 'parties', 'items', 'transactions', 'raw_materials'.
   * @param {number} index - The slot index (1-5).
   */
  const getLabel = (entity, index) => {
    const list = config?.[`${entity}_fields`] || []
    return list.find(f => f.index === index)?.label || `Field ${index}`
  }

  /**
   * isVisible - Checks if a specific variable field is marked as visible.
   * @param {string} entity - 'parties', 'items', 'transactions', 'raw_materials'.
   * @param {number} index - The slot index (1-5).
   */
  const isVisible = (entity, index) => {
    const list = config?.[`${entity}_fields`] || []
    return list.find(f => f.index === index)?.visible === true
  }

  return {
    config: db ? config : null,
    loading: !db || loading,
    error,
    isPluginEnabled,
    getLabel,
    isVisible,
    businessName: config?.business_name || 'Business OS',
    updateConfig,
  }
}
