// JobFill BD - Final Intelligence Add-on 2: Field Relationship Graph
// Builds an ontological relationship graph connecting canonical profile fields
// to parent conceptual groups, sibling fields, and dependency chains.
// Prevents array-position or label-only guessing.

export interface FieldGraphNode {
  canonicalId: string;
  parentGroup: string;
  category: string;
  siblings: string[];
  dependsOn?: string[];
  incompatibleGroups: string[];
}

export class FieldRelationshipGraph {
  private static readonly GRAPH: Map<string, FieldGraphNode> = new Map();

  static {
    // Helper to register nodes
    const register = (
      id: string,
      parent: string,
      category: string,
      siblings: string[],
      incompatible: string[] = [],
      dependsOn?: string[]
    ) => {
      this.GRAPH.set(id, {
        canonicalId: id,
        parentGroup: parent,
        category,
        siblings,
        dependsOn,
        incompatibleGroups: incompatible,
      });
    };

    // =================== SSC GROUP ===================
    const sscSiblings = [
      'education.ssc.examination',
      'education.ssc.board',
      'education.ssc.roll',
      'education.ssc.registration',
      'education.ssc.group',
      'education.ssc.result',
      'education.ssc.gpa',
      'education.ssc.passingYear',
    ];
    for (const id of sscSiblings) {
      register(id, 'education.ssc', 'education', sscSiblings.filter((s) => s !== id), [
        'education.hsc',
        'education.graduation',
        'education.masters',
        'address.present',
        'address.permanent',
        'employment.experience',
      ]);
    }

    // =================== HSC GROUP ===================
    const hscSiblings = [
      'education.hsc.examination',
      'education.hsc.board',
      'education.hsc.roll',
      'education.hsc.registration',
      'education.hsc.group',
      'education.hsc.result',
      'education.hsc.gpa',
      'education.hsc.passingYear',
    ];
    for (const id of hscSiblings) {
      register(id, 'education.hsc', 'education', hscSiblings.filter((s) => s !== id), [
        'education.ssc',
        'education.graduation',
        'education.masters',
        'address.present',
        'address.permanent',
      ]);
    }

    // =================== GRADUATION GROUP ===================
    const gradSiblings = [
      'education.graduation.degree',
      'education.graduation.subject',
      'education.graduation.institution',
      'education.graduation.result',
      'education.graduation.gpa',
      'education.graduation.passingYear',
      'education.graduation.courseDuration',
    ];
    for (const id of gradSiblings) {
      register(id, 'education.graduation', 'education', gradSiblings.filter((s) => s !== id), [
        'education.ssc',
        'education.hsc',
        'education.masters',
      ]);
    }

    // =================== PRESENT ADDRESS GROUP ===================
    const presSiblings = [
      'address.present.careOf',
      'address.present.village',
      'address.present.division',
      'address.present.district',
      'address.present.upazila',
      'address.present.postOffice',
      'address.present.postCode',
    ];
    for (const id of presSiblings) {
      register(
        id,
        'address.present',
        'address',
        presSiblings.filter((s) => s !== id),
        ['address.permanent', 'education.ssc', 'education.hsc'],
        id === 'address.present.upazila' ? ['address.present.district'] : undefined
      );
    }

    // =================== PERMANENT ADDRESS GROUP ===================
    const permSiblings = [
      'address.permanent.careOf',
      'address.permanent.village',
      'address.permanent.division',
      'address.permanent.district',
      'address.permanent.upazila',
      'address.permanent.postOffice',
      'address.permanent.postCode',
    ];
    for (const id of permSiblings) {
      register(
        id,
        'address.permanent',
        'address',
        permSiblings.filter((s) => s !== id),
        ['address.present', 'education.ssc', 'education.hsc'],
        id === 'address.permanent.upazila' ? ['address.permanent.district'] : undefined
      );
    }

    // =================== FAMILY GROUPS ===================
    register('family.father.name.english', 'family.father', 'family', ['family.father.name.bangla'], ['family.mother', 'family.spouse', 'applicant']);
    register('family.father.name.bangla', 'family.father', 'family', ['family.father.name.english'], ['family.mother', 'family.spouse', 'applicant']);
    register('family.mother.name.english', 'family.mother', 'family', ['family.mother.name.bangla'], ['family.father', 'family.spouse', 'applicant']);
    register('family.mother.name.bangla', 'family.mother', 'family', ['family.mother.name.english'], ['family.father', 'family.spouse', 'applicant']);
  }

  // Get node for canonical ID
  public static getNode(canonicalId: string): FieldGraphNode | undefined {
    return this.GRAPH.get(canonicalId);
  }

  // Check if a canonical field is valid within an identified section context
  public static isContextCompatible(canonicalId: string, identifiedContextGroup: string): boolean {
    const node = this.GRAPH.get(canonicalId);
    if (!node) return true;

    if (node.incompatibleGroups.includes(identifiedContextGroup)) {
      return false;
    }
    return true;
  }

  // Returns dependent predecessor field if any (e.g. Upazila depends on District)
  public static getDependency(canonicalId: string): string[] {
    return this.GRAPH.get(canonicalId)?.dependsOn || [];
  }
}
