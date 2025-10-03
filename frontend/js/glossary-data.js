// SommOS Glossary Data
// Comprehensive definitions for wine terminology, system metrics, user roles, and features

/**
 * Glossary Data Maintenance Guide
 * ================================
 * 
 * Updating the Glossary:
 * - To add new terms: Add entries to the appropriate category in the glossaryData object below
 * - Structure for each term: { "Term Name": { definition: "...", examples: [...] } }
 * - Available categories: "Wine Terminology", "System Metrics", "User Roles", "Features & Actions"
 * 
 * When to Update:
 * - When adding new system features or metrics that users should understand
 * - When introducing new wine domain terminology in the UI
 * - When user feedback indicates confusion about existing terms
 * 
 * Best Practices:
 * - Keep definitions concise but comprehensive (2-3 sentences ideal)
 * - Provide 1-3 practical examples for each term
 * - Use consistent terminology across all glossary entries
 * - Update relevant documentation (WARP.md, README.md) when adding system-related terms
 * 
 * Note: This is a static data file. Changes require code deployment.
 * For dynamic glossary management, consider implementing an admin UI in the future.
 */

export const glossaryData = {
    "Wine Terminology": {
        "Tannin": {
            "definition": "Naturally occurring compounds in wine that affect astringency and texture. Tannins come from grape skins, seeds, and stems, as well as from oak aging. Higher tannins can make a wine feel more dry or bitter on the palate.",
            "examples": ["Red wines like Cabernet Sauvignon typically have high tannins", "White wines generally have low tannins"]
        },
        "Body": {
            "definition": "The weight and fullness of wine in the mouth, often described as light, medium, or full-bodied. Body is influenced by alcohol content, residual sugar, and extract.",
            "examples": ["Pinot Noir is typically light to medium-bodied", "Cabernet Sauvignon is usually full-bodied"]
        },
        "Acidity": {
            "definition": "The tartness or crispness in wine that provides freshness and structure. Acidity balances sweetness and helps wine pair with food. Cool climate wines tend to have higher acidity.",
            "examples": ["Sauvignon Blanc has high acidity", "Viognier typically has lower acidity"]
        },
        "Finish": {
            "definition": "The lasting impression and flavors that remain in your mouth after swallowing wine. A long finish is often associated with quality wines and can last 30 seconds or more.",
            "examples": ["Premium wines often have a complex, lingering finish", "Simple table wines may have a short finish"]
        },
        "Structure": {
            "definition": "The framework of a wine, comprising its balance of tannins, acidity, alcohol, and body. Well-structured wines have all elements in harmony.",
            "examples": ["Bordeaux wines are known for their structured nature", "Aged wines develop more integrated structure over time"]
        },
        "Terroir": {
            "definition": "The complete natural environment in which wine is produced, including soil, topography, climate, and local grape-growing traditions. Terroir gives wine its unique character.",
            "examples": ["Burgundy terroir produces distinctive Pinot Noir", "Volcanic soils create unique mineral characteristics"]
        },
        "Nose": {
            "definition": "The aroma or bouquet of wine. 'Nose' refers to everything you smell, including both primary fruit aromas and complex secondary notes from aging.",
            "examples": ["A wine might have a nose of blackberries and vanilla", "Older wines develop more complex nose characteristics"]
        },
        "Palate": {
            "definition": "The taste and texture of wine in your mouth. The palate refers to the flavors, body, acidity, tannins, and overall mouthfeel experienced when tasting.",
            "examples": ["The palate shows ripe cherry and spice notes", "A wine can be fruit-forward on the nose but mineral on the palate"]
        },
        "Vintage": {
            "definition": "The year when grapes were harvested to make a particular wine. Vintage quality can vary significantly based on weather conditions during the growing season.",
            "examples": ["2015 was an excellent vintage in Bordeaux", "Non-vintage Champagnes blend multiple years"]
        },
        "Appellation": {
            "definition": "A legally defined and protected geographical indication used to identify where wine grapes were grown. Appellations often have specific regulations about grape varieties and production methods.",
            "examples": ["Napa Valley is an American appellation", "Châteauneuf-du-Pape is a French appellation"]
        },
        "Decanting": {
            "definition": "The process of pouring wine from its bottle into another container (a decanter) before serving. This aerates the wine and can separate sediment in older wines.",
            "examples": ["Young Cabernet Sauvignon benefits from decanting", "Old Burgundy may need gentle decanting to remove sediment"]
        },
        "Oak": {
            "definition": "Wood from oak trees used to make barrels for wine aging. Oak imparts flavors like vanilla, toast, and spice, while also allowing slight oxidation that softens wine.",
            "examples": ["Chardonnay is often aged in oak barrels", "French oak is prized for its subtle flavors"]
        },
        "Varietal": {
            "definition": "A wine made primarily from a single grape variety, named after that grape. In most regions, a varietal wine must contain at least 75-85% of the named grape.",
            "examples": ["Cabernet Sauvignon is a varietal wine", "Merlot, Pinot Noir, and Chardonnay are common varietals"]
        },
        "Estate": {
            "definition": "A wine produced entirely from grapes grown on property owned or controlled by the winery. Estate wines represent the winery's complete control over quality from vineyard to bottle.",
            "examples": ["Estate bottled indicates grapes from owned vineyards", "Estate wines often reflect the winery's terroir"]
        },
        "Reserve": {
            "definition": "A wine designation suggesting higher quality, though its meaning varies by region and producer. In the context of SommOS, 'Reserve' also means setting aside bottles for future service.",
            "examples": ["Gran Reserva in Spain requires extended aging", "Private Reserve often indicates a winery's best wine"]
        },
        "Minerality": {
            "definition": "A tasting descriptor for wines with a subtle, earthy, or stony character often associated with certain soils. Minerality is more about texture and sensation than specific flavors.",
            "examples": ["Chablis is known for its mineral character", "Riesling from slate soils shows pronounced minerality"]
        },
        "Bouquet": {
            "definition": "The complex aromas that develop in wine through aging and winemaking processes, distinct from primary fruit aromas. Bouquet includes secondary and tertiary characteristics.",
            "examples": ["Aged Bordeaux develops a bouquet of tobacco and leather", "Champagne's bouquet includes brioche and toast notes"]
        },
        "Malolactic Fermentation": {
            "definition": "A secondary fermentation that converts tart malic acid into softer lactic acid, creating a rounder, creamier texture. Common in red wines and buttery Chardonnays.",
            "examples": ["Most red wines undergo malolactic fermentation", "Buttery Chardonnay results from malolactic fermentation"]
        }
    },
    
    "System Metrics": {
        "Pairing Confidence": {
            "definition": "A percentage score (0-100%) displayed in pairing recommendations that indicates how certain SommOS is that a wine will complement your dish. This metric blends multiple pairing heuristics to provide a comprehensive confidence rating.",
            "factors": [
                "Flavor Harmony: Analyzes the match between tasting notes in your dish description and the wine's profile",
                "Structure Balance: Considers acidity, tannin, and body so richer dishes lean toward fuller wines",
                "Service Readiness: Gives a boost when bottles are in stock and at optimal serving temperature or aging window"
            ],
            "usage": "Higher confidence scores (80%+) indicate excellent pairings. Scores of 60-79% suggest good matches worth considering. Below 60% indicates the pairing may work but isn't ideal."
        },
        "Procurement Opportunity": {
            "definition": "A score used on the procurement tab that highlights the smartest restocking moves by weighing potential value against urgency. This helps prioritize which wines to purchase.",
            "factors": [
                "Inventory Gap: Prioritizes wines that fill shortages or complement upcoming service plans",
                "Supplier Signal: Accounts for supplier reliability, available allocations, and delivery windows",
                "Cost Efficiency: Rewards offers that achieve better price-to-value or long-term appreciation potential"
            ],
            "usage": "High opportunity scores indicate urgent or valuable purchases. Review these regularly to maintain optimal inventory levels."
        },
        "Vintage Quality": {
            "definition": "A 0-100 rating shown for cellared bottles that blends critic consensus with SommOS aging models to track drinking windows and assess vintage quality.",
            "factors": [
                "Critical Reviews: Aggregates trusted publications and competitions for the vintage",
                "Aging Potential: Evaluates grape variety, region, and storage history to estimate peak maturity",
                "Cellar Readiness: Adjusts for bottle condition and service notes entered by your crew"
            ],
            "usage": "Scores above 90 indicate exceptional vintages. 80-89 suggests excellent quality. Below 80 may indicate challenging vintages or wines past their peak."
        },
        "Service Readiness": {
            "definition": "An indicator of whether a wine is currently at its optimal drinking window, properly stored, and available for service. This helps crew make informed decisions about which wines to serve.",
            "factors": [
                "Current age vs. recommended drinking window",
                "Storage conditions and temperature",
                "Available quantity in accessible locations"
            ],
            "usage": "Used to prioritize which wines should be served soon versus which should continue aging."
        },
        "Stock Level": {
            "definition": "The current quantity of bottles available for a particular wine or vintage. Stock levels are tracked by location and updated in real-time as bottles are consumed or received.",
            "categories": [
                "In Stock: Bottles currently available for service",
                "Reserved: Bottles set aside for specific events or guests",
                "Low Stock: Below minimum threshold, triggering procurement alerts"
            ],
            "usage": "Monitor stock levels to ensure popular wines remain available and trigger timely reordering."
        },
        "Ensemble Method": {
            "definition": "A machine learning technique used by SommOS that combines multiple prediction models to provide more accurate and reliable wine recommendations. Rather than relying on a single algorithm, ensemble methods leverage the strengths of multiple approaches.",
            "benefits": [
                "More robust predictions across diverse scenarios",
                "Reduced risk of overfitting to specific patterns",
                "Better handling of edge cases and unusual requests"
            ],
            "usage": "Ensemble methods power SommOS's pairing recommendations and procurement analysis, providing confidence scores backed by multiple analytical perspectives."
        }
    },
    
    "User Roles": {
        "Guest": {
            "definition": "Temporary, read-only access to browse the wine collection. Guests can view wines, read tasting notes, and see pairing suggestions, but cannot make changes to inventory or place orders.",
            "permissions": [
                "View wine catalog and collection",
                "Browse tasting notes and food pairings",
                "See pairing recommendations",
                "Access wine details and history"
            ],
            "restrictions": [
                "Cannot modify inventory",
                "Cannot reserve or consume wines",
                "Cannot access procurement features",
                "Cannot view cost or supplier information"
            ],
            "access_method": "Guests log in using an event code provided by crew members. Guest sessions typically expire after 4 hours.",
            "use_cases": "Ideal for yacht guests who want to explore the collection during events or meals without risk of accidental changes."
        },
        "Crew": {
            "definition": "Full operational access for yacht crew members responsible for daily wine service and inventory management. Crew can perform all service-related tasks but cannot modify system settings.",
            "permissions": [
                "All Guest permissions plus:",
                "Reserve wines for upcoming service",
                "Record wine consumption and service",
                "Add service notes and guest memories",
                "View procurement recommendations",
                "Create and manage events",
                "Access cost and inventory value data"
            ],
            "restrictions": [
                "Cannot modify wine database structure",
                "Cannot create or delete user accounts",
                "Cannot access system configuration",
                "Limited supplier management capabilities"
            ],
            "use_cases": "Chief stewards, sommeliers, and yacht crew managing daily wine service and maintaining accurate inventory records."
        },
        "Admin": {
            "definition": "Full system access for yacht managers and system administrators. Admins have unrestricted access to all features, including system configuration, user management, and supplier relationships.",
            "permissions": [
                "All Crew permissions plus:",
                "Manage user accounts and permissions",
                "Configure system settings",
                "Full supplier management",
                "Access all financial data",
                "Create and modify wine database entries",
                "Export data and generate reports",
                "Configure ML models and algorithms"
            ],
            "use_cases": "Yacht owners, managers, and IT administrators who need complete control over the wine management system."
        }
    },
    
    "Features & Actions": {
        "Reserve Wine": {
            "definition": "Setting aside specific bottles for a planned event, guest, or occasion. Reserved wines are marked as unavailable for general service until the reservation is fulfilled or cancelled.",
            "how_it_works": "Navigate to a wine's detail page and click 'Reserve Wine'. Specify the quantity, date needed, and optional notes about the event or purpose. Reserved bottles remain in their storage location but are flagged in the system.",
            "best_practices": [
                "Reserve wines several days before major events",
                "Add detailed notes about the occasion",
                "Review reservations regularly to release unused bottles",
                "Coordinate with crew to ensure proper wine preparation"
            ],
            "crew_only": true
        },
        "Consume Wine": {
            "definition": "Recording when bottles are opened and served. This action decrements inventory, creates a consumption record, and allows capturing service notes about the experience.",
            "how_it_works": "Click 'Serve Wine' on a wine's detail page. Enter the quantity consumed, guest information (if applicable), and optional tasting notes or service observations. The system automatically updates stock levels.",
            "best_practices": [
                "Record consumption immediately after service",
                "Add detailed tasting notes for future reference",
                "Note guest reactions and preferences",
                "Include food pairing information when relevant"
            ],
            "crew_only": true
        },
        "Pairing Algorithm": {
            "definition": "SommOS's AI-powered system for matching wines with dishes based on flavor profiles, structure, intensity, and traditional pairing principles. The algorithm considers both classical rules and modern culinary trends.",
            "approach": "Combines natural language processing to understand dish descriptions with wine characteristic databases and machine learning models trained on successful pairings. Uses ensemble methods to provide confidence scores.",
            "inputs": [
                "Dish description and ingredients",
                "Cooking method and cuisine style",
                "Meal occasion and guest preferences",
                "Available inventory and wine readiness"
            ],
            "outputs": "Ranked list of wine recommendations with confidence scores, pairing rationales, and alternative suggestions."
        },
        "Quick Pairing": {
            "definition": "A streamlined version of the pairing assistant designed for rapid recommendations during service. Quick Pairing focuses on currently available wines and provides immediate suggestions.",
            "when_to_use": "During active meal service when time is limited, or when guests request immediate wine recommendations without detailed analysis.",
            "difference_from_full_pairing": "Quick Pairing skips optional fields like occasion and guest count, focuses on in-stock wines, and returns fewer but highly confident matches."
        },
        "Procurement Analysis": {
            "definition": "AI-powered system that analyzes your inventory, consumption patterns, and supplier offerings to recommend optimal wine purchases. Helps maintain balanced stock while identifying value opportunities.",
            "analysis_includes": [
                "Gap analysis: Identifies missing wine categories or low stock",
                "Trend analysis: Predicts future consumption based on patterns",
                "Value opportunities: Highlights favorable pricing or allocations",
                "Seasonal recommendations: Suggests wines for upcoming seasons"
            ],
            "crew_only": true
        },
        "Purchase Decision Tool": {
            "definition": "An interactive assistant that guides crew through evaluating potential wine purchases. Compares options based on price, quality, inventory needs, and long-term value.",
            "use_cases": [
                "Comparing multiple wine options from different suppliers",
                "Deciding whether to purchase allocated or limited wines",
                "Evaluating investment-grade wines for cellaring",
                "Balancing budget constraints with quality goals"
            ],
            "crew_only": true
        },
        "Service Notes": {
            "definition": "Detailed records captured by crew about wine service experiences. Service notes include guest reactions, pairing successes, optimal serving conditions, and any special observations.",
            "importance": "Service notes create institutional memory, helping crew provide consistent excellent service. They inform future pairing recommendations and help identify guest preferences.",
            "best_practices": [
                "Record notes immediately while details are fresh",
                "Include both positive and negative observations",
                "Note specific guest preferences and reactions",
                "Tag notes for easy retrieval"
            ],
            "crew_only": true
        },
        "Event Management": {
            "definition": "Tools for planning and tracking wine service for yacht events, parties, and special occasions. Event management links wines, guests, and service notes to specific occasions.",
            "features": [
                "Create events with date, location, and guest count",
                "Assign wines to specific courses or moments",
                "Track RSVPs and dietary restrictions",
                "Generate service checklists and preparations"
            ],
            "crew_only": true
        },
        "Wine History": {
            "definition": "A complete timeline of all activities related to a specific wine or vintage, including purchases, storage moves, reservations, consumption, and service notes.",
            "information_shown": [
                "Acquisition date and supplier",
                "Storage location history",
                "Temperature and condition logs",
                "All service instances with dates and notes",
                "Reservations and special allocations"
            ],
            "use_cases": "Understanding wine provenance, tracking service frequency, identifying popular wines, and auditing inventory changes."
        },
        "Sync Data": {
            "definition": "Manually triggers synchronization between the frontend app and backend server. Useful for ensuring the latest inventory data when returning from offline operation.",
            "when_to_use": [
                "After extended offline operation",
                "When multiple crew members are using the system",
                "Before important service to ensure accurate stock",
                "After bulk inventory updates"
            ],
            "automatic_sync": "SommOS automatically syncs in the background when online, but manual sync ensures immediate data consistency."
        },
        "Cellar Snapshot": {
            "definition": "A comprehensive overview of wine inventory value, stock levels, and collection composition. Provides high-level metrics for monitoring collection health.",
            "metrics_included": [
                "Total inventory value",
                "Number of bottles by category",
                "Average cost per bottle",
                "Stock distribution by location",
                "Aging wines vs. ready-to-drink ratio"
            ],
            "use_cases": "Regular inventory reviews, insurance documentation, collection planning, and budget management."
        }
    },
    
    "Wine Scoring Systems": {
        "100-Point Scale": {
            "definition": "The most common wine rating system, pioneered by Robert Parker, where wines are scored from 50-100 points. Scores above 90 indicate outstanding wines; 95+ are considered exceptional.",
            "ranges": [
                "96-100: Extraordinary, truly exceptional wines",
                "90-95: Outstanding wines of superior character",
                "85-89: Very good wines with special qualities",
                "80-84: Above average, solid wines",
                "75-79: Average, drinkable wines",
                "Below 75: Wines with noticeable flaws"
            ],
            "usage_in_sommos": "SommOS aggregates scores from multiple critics and publications to provide a consensus rating for Vintage Quality calculations."
        },
        "5-Star System": {
            "definition": "A simplified rating system using 1-5 stars, often used for quick assessments and consumer-friendly ratings.",
            "equivalence": [
                "5 stars ≈ 95-100 points",
                "4 stars ≈ 85-94 points",
                "3 stars ≈ 75-84 points",
                "2 stars ≈ 65-74 points",
                "1 star ≈ below 65 points"
            ]
        }
    },
    
    "Storage & Service": {
        "Cellar Temperature": {
            "definition": "The ideal long-term storage temperature for wine, typically 55°F (13°C). Consistent temperature is more important than exact temperature.",
            "ranges": [
                "Long-term storage: 50-59°F (10-15°C)",
                "Short-term storage: 45-65°F (7-18°C)",
                "Service temperature varies by wine type"
            ],
            "importance": "Temperature fluctuations can damage wine quality. SommOS tracks storage conditions and alerts crew to potential issues."
        },
        "Serving Temperature": {
            "definition": "The optimal temperature at which wine should be served to maximize flavor and aroma expression. Serving temperature varies significantly by wine type.",
            "guidelines": [
                "Sparkling wines: 40-50°F (4-10°C)",
                "White wines: 45-55°F (7-13°C)",
                "Rosé wines: 50-55°F (10-13°C)",
                "Light red wines: 55-60°F (13-16°C)",
                "Full-bodied reds: 60-65°F (16-18°C)"
            ],
            "usage_in_sommos": "SommOS provides serving temperature guidance for each wine and factors service readiness into pairing recommendations."
        },
        "Humidity": {
            "definition": "The amount of moisture in the air, critical for proper wine storage. Ideal cellar humidity is 60-70%.",
            "effects": [
                "Too low: Corks dry out, allowing air into bottles",
                "Too high: Labels deteriorate, mold may develop",
                "Proper humidity: Preserves cork integrity and wine quality"
            ]
        }
    }
};

// Helper function to search glossary
export function searchGlossary(query) {
    const results = [];
    const lowerQuery = query.toLowerCase();
    
    for (const [category, terms] of Object.entries(glossaryData)) {
        for (const [term, content] of Object.entries(terms)) {
            const definition = typeof content === 'object' ? content.definition : content;
            
            if (term.toLowerCase().includes(lowerQuery) || 
                definition.toLowerCase().includes(lowerQuery)) {
                results.push({
                    category,
                    term,
                    content
                });
            }
        }
    }
    
    return results;
}

// Helper function to get all terms in a category
export function getTermsByCategory(category) {
    return glossaryData[category] || {};
}

// Helper function to get all categories
export function getCategories() {
    return Object.keys(glossaryData);
}
